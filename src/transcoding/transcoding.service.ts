import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '@/s3/s3.service';
import { HLSService } from '@/hls/hls.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Dynamic imports for FFmpeg (optional dependencies)
interface FFmpegStatic {
  (input?: string): FFmpegCommand;
  setFfmpegPath(path: string): void;
}

interface FFmpegProgress {
  percent?: number;
  frames?: number;
  currentFps?: number;
  currentKbps?: number;
  targetSize?: number;
  timemark?: string;
}

interface FFmpegCommand {
  outputOptions(options: string[]): FFmpegCommand;
  output(path: string): FFmpegCommand;
  on(event: 'start', callback: (commandLine: string) => void): FFmpegCommand;
  on(event: 'progress', callback: (progress: FFmpegProgress) => void): FFmpegCommand;
  on(event: 'end', callback: () => void): FFmpegCommand;
  on(event: 'error', callback: (err: Error) => void): FFmpegCommand;
  run(): void;
}

interface FFmpegInstaller {
  path: string;
}

let ffmpeg: FFmpegStatic | null = null;
let ffmpegInstaller: FFmpegInstaller | null = null;

try {
  ffmpeg = require('fluent-ffmpeg') as FFmpegStatic;
  ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as FFmpegInstaller;
} catch (error) {
  // FFmpeg packages not installed
}

export interface TranscodingJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  episodeId: string;
  inputUrl: string;
  outputPrefix: string;
  qualities: string[];
}

export interface TranscodingResult {
  jobId: string;
  status: 'completed' | 'failed';
  hlsManifestUrl?: string;
  variants?: Array<{
    quality: string;
    manifestUrl: string;
    resolution: string;
    bandwidth: number;
  }>;
  error?: string;
}

@Injectable()
export class TranscodingService {
  private readonly logger = new Logger(TranscodingService.name);
  private bucketName: string;
  private region: string;
  private activeJobs: Map<string, { status: 'pending' | 'processing' | 'completed' | 'failed'; episodeId: string; qualities: string[] }> = new Map();

  constructor(
    private configService: ConfigService,
    private s3Service: S3Service,
    private hlsService: HLSService,
  ) {
    this.bucketName = this.configService.get<string>('S3_BUCKET')!;
    this.region = this.configService.get<string>('AWS_REGION')!;
    
    // Setup FFmpeg path
    if (ffmpeg && ffmpegInstaller) {
      try {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
        this.logger.log('FFmpeg transcoding enabled');
      } catch (error) {
        this.logger.warn('FFmpeg path setup failed. Please install FFmpeg.');
      }
    } else {
      this.logger.warn('FFmpeg packages not installed. Please run: npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg');
    }
  }

  /**
   * Start transcoding job for video
   * @param episodeId - Episode ID
   * @param inputVideoUrl - URL of the source video
   * @param qualities - Array of quality levels to generate (e.g., ['360p', '480p', '720p', '1080p'])
   * @returns Transcoding job information
   */
  async startTranscodingJob(
    episodeId: string,
    inputVideoUrl: string,
    qualities: string[] = ['360p', '480p', '720p', '1080p'],
  ): Promise<TranscodingJob> {
    this.logger.log(`Starting transcoding job for episode ${episodeId}`);
    return this.startFFmpegJob(episodeId, inputVideoUrl, qualities);
  }

  /**
   * Start FFmpeg transcoding job
   */
  private async startFFmpegJob(
    episodeId: string,
    inputVideoUrl: string,
    qualities: string[],
  ): Promise<TranscodingJob> {
    if (!ffmpeg) {
      throw new Error(
        'FFmpeg is not installed. Please run: npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg'
      );
    }

    const jobId = `ffmpeg-${episodeId}-${Date.now()}`;
    
    // Register job as pending
    this.activeJobs.set(jobId, {
      status: 'processing',
      episodeId,
      qualities,
    });

    // Start transcoding asynchronously
    this.processFFmpegTranscoding(jobId, episodeId, inputVideoUrl, qualities).catch((error) => {
      this.logger.error(`FFmpeg transcoding failed for job ${jobId}:`, error);
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'failed';
      }
    });

    return {
      jobId,
      status: 'pending',
      episodeId,
      inputUrl: inputVideoUrl,
      outputPrefix: `hls/episodes/${episodeId}/`,
      qualities,
    };
  }

  /**
   * Process FFmpeg transcoding
   */
  private async processFFmpegTranscoding(
    jobId: string,
    episodeId: string,
    inputVideoUrl: string,
    qualities: string[],
  ): Promise<void> {
    const tempDir = path.join(os.tmpdir(), `transcode-${episodeId}-${Date.now()}`);
    let inputFilePath: string | null = null;

    try {
      // Create temp directory
      fs.mkdirSync(tempDir, { recursive: true });

      // Download video from S3
      this.logger.log(`Downloading video from S3 for episode ${episodeId}`);
      const key = this.s3Service.extractKeyFromUrl(inputVideoUrl);
      if (!key) {
        throw new Error('Invalid video URL');
      }

      const videoBuffer = await this.s3Service.downloadFile(key);
      inputFilePath = path.join(tempDir, `input.${path.extname(key).slice(1) || 'mp4'}`);
      fs.writeFileSync(inputFilePath, videoBuffer);

      this.logger.log(`Video downloaded, starting transcoding for ${qualities.length} qualities`);

      const qualityConfigs = this.getQualityConfigs();
      const segmentDuration = 10; // 10 seconds per segment

      // Transcode each quality
      for (const quality of qualities) {
        const config = qualityConfigs.find((q) => q.quality === quality);
        if (!config) {
          this.logger.warn(`Skipping unknown quality: ${quality}`);
          continue;
        }

        const [width, height] = config.resolution.split('x').map(Number);
        const outputDir = path.join(tempDir, quality);
        fs.mkdirSync(outputDir, { recursive: true });

        const outputPattern = path.join(outputDir, 'segment_%03d.ts');
        const manifestPath = path.join(outputDir, `${quality}.m3u8`);

        this.logger.log(`Transcoding ${quality} (${width}x${height} @ ${config.bandwidth}bps)`);

        // Transcode video using FFmpeg
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputFilePath!)
            .outputOptions([
              '-c:v', 'libx264',
              '-c:a', 'aac',
              '-b:v', `${config.bandwidth}`,
              '-b:a', '128k',
              '-s', `${width}x${height}`,
              '-hls_time', `${segmentDuration}`,
              '-hls_playlist_type', 'vod',
              '-hls_segment_filename', outputPattern,
              '-f', 'hls',
            ])
            .output(manifestPath)
            .on('start', (commandLine) => {
              this.logger.debug(`FFmpeg command: ${commandLine}`);
            })
            .on('progress', (progress: FFmpegProgress) => {
              const percent = progress.percent || 0;
              this.logger.debug(`Transcoding ${quality}: ${percent}% done`);
            })
            .on('end', () => {
              this.logger.log(`Transcoding ${quality} completed`);
              resolve();
            })
            .on('error', (err) => {
              this.logger.error(`FFmpeg error for ${quality}:`, err);
              reject(err);
            })
            .run();
        });

        // Upload segments and manifest to S3
        this.logger.log(`Uploading ${quality} segments to S3`);
        
        // Upload manifest
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        await this.s3Service.uploadHLSManifest(manifestContent, episodeId, `${quality}/${quality}.m3u8`);

        // Upload segments
        const segmentFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'));
        for (const segmentFile of segmentFiles) {
          const segmentBuffer = fs.readFileSync(path.join(outputDir, segmentFile));
          await this.s3Service.uploadHLSSegment(segmentBuffer, episodeId, quality, segmentFile);
        }

        this.logger.log(`Uploaded ${segmentFiles.length} segments for ${quality}`);
      }

      // Update job status
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'completed';
      }

      this.logger.log(`FFmpeg transcoding completed for episode ${episodeId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`FFmpeg transcoding error: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.status = 'failed';
      }
      throw error;
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          this.logger.log(`Cleaned up temp directory: ${tempDir}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp directory: ${tempDir}`, error);
      }
    }
  }

  /**
   * Check transcoding job status
   * @param jobId - Transcoding job ID
   * @returns Job status and result if completed
   */
  async getJobStatus(jobId: string): Promise<TranscodingResult> {
    // Check if it's an FFmpeg job
    const ffmpegJob = this.activeJobs.get(jobId);
    if (ffmpegJob) {
      if (ffmpegJob.status === 'completed') {
        // Generate manifests
        const manifestResult = await this.generateHLSManifests(ffmpegJob.episodeId, ffmpegJob.qualities);
        return {
          jobId,
          status: 'completed',
          hlsManifestUrl: manifestResult.masterManifestUrl,
          variants: manifestResult.variants,
        };
      } else if (ffmpegJob.status === 'failed') {
        return {
          jobId,
          status: 'failed',
          error: 'FFmpeg transcoding failed',
        };
      } else {
        // Still processing
        return {
          jobId,
          status: 'failed',
          error: `Job status: ${ffmpegJob.status}`,
        };
      }
    }

    throw new Error(`Job ${jobId} not found`);
  }

  /**
   * Generate HLS manifest files from transcoded segments
   * This should be called after transcoding is complete
   * @param episodeId - Episode ID
   * @param qualities - Array of quality levels
   * @returns HLS manifest URLs
   */
  async generateHLSManifests(
    episodeId: string,
    qualities: string[],
  ): Promise<{
    masterManifestUrl: string;
    variants: Array<{
      quality: string;
      manifestUrl: string;
      resolution: string;
      bandwidth: number;
    }>;
  }> {
    this.logger.log(`Generating HLS manifests for episode ${episodeId} with qualities: ${qualities.join(', ')}`);

    const qualityConfigs = this.getQualityConfigs();
    const variants: Array<{
      quality: string;
      manifestUrl: string;
      resolution: string;
      bandwidth: number;
    }> = [];

    // The manifest files are at: hls/episodes/{episodeId}/{quality}/{quality}.m3u8
    for (const quality of qualities) {
      const config = qualityConfigs.find((q) => q.quality === quality);
      if (!config) {
        this.logger.warn(`Skipping unknown quality: ${quality}`);
        continue;
      }

      const manifestFilename = `${quality}.m3u8`;
      const manifestUrl = this.s3Service.getHLSManifestUrl(episodeId, `${quality}/${manifestFilename}`);

      variants.push({
        quality,
        manifestUrl,
        resolution: config.resolution,
        bandwidth: config.bandwidth,
      });
    }

    // Generate master manifest
    const hlsVariants = variants.map((v) => ({
      manifestUrl: v.manifestUrl,
      resolution: v.resolution,
      bandwidth: v.bandwidth,
      codecs: 'avc1.42e01e,mp4a.40.2', // Default codecs
    }));

    const masterManifestContent = this.hlsService.generateMasterManifest(hlsVariants);
    const masterManifestUrl = await this.s3Service.uploadHLSManifest(
      masterManifestContent,
      episodeId,
      'master.m3u8',
    );

    this.logger.log(`HLS manifests generated for episode ${episodeId}`);

    return {
      masterManifestUrl,
      variants,
    };
  }

  /**
   * Get default quality configurations
   */
  getQualityConfigs(): Array<{ quality: string; resolution: string; bandwidth: number }> {
    return [
      { quality: '360p', resolution: '640x360', bandwidth: 500 * 1000 },
      { quality: '480p', resolution: '854x480', bandwidth: 1000 * 1000 },
      { quality: '720p', resolution: '1280x720', bandwidth: 2500 * 1000 },
      { quality: '1080p', resolution: '1920x1080', bandwidth: 5000 * 1000 },
    ];
  }
}

