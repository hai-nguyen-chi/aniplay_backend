import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Episode, EpisodeDocument } from '@/episodes/schemas/episode.schema';
import { CreateEpisodeDto } from '@/episodes/dto/create-episode.dto';
import { UpdateEpisodeDto } from '@/episodes/dto/update-episode.dto';
import { QueryEpisodeDto } from '@/episodes/dto/query-episode.dto';
import { S3Service } from '@/s3/s3.service';
import { HLSService } from '@/hls/hls.service';
import { TranscodingService } from '@/transcoding/transcoding.service';
import type { Multer } from 'multer';
import { Readable } from 'stream';

@Injectable()
export class EpisodesService {
  private readonly logger = new Logger(EpisodesService.name);

  constructor(
    @InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>,
    private readonly s3Service: S3Service,
    private readonly hlsService: HLSService,
    private readonly transcodingService: TranscodingService,
  ) {}

  async create(dto: CreateEpisodeDto) {
    const exists = await this.episodeModel.exists({ animeId: dto.animeId, number: dto.number }).lean();
    if (exists) throw new ConflictException('Episode number already exists for this anime');
    const payload = { ...dto, animeId: new Types.ObjectId(dto.animeId) };
    const doc = await this.episodeModel.create(payload);
    return doc.toObject();
  }

  async findAll(query: QueryEpisodeDto) {
    const { animeId, q, offset = 0, limit = 20 } = query;
    const filter: FilterQuery<EpisodeDocument> = {};
    if (animeId) {
      filter.animeId = new Types.ObjectId(animeId);
    }
    if (q && q.trim()) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { synopsis: { $regex: q, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.episodeModel.find(filter).sort({ number: 1, createdAt: -1 }).skip(offset).limit(limit).lean().exec(),
      this.episodeModel.countDocuments(filter).exec(),
    ]);
    return { items, total, offset, limit };
  }

  async findOne(id: string) {
    const doc = await this.episodeModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Episode not found');
    return doc;
  }

  async update(id: string, dto: UpdateEpisodeDto) {
    // Build update data, excluding animeId and airDate (will be handled separately)
    const { animeId, airDate, ...restDto } = dto;
    const updateData: Partial<EpisodeDocument> = { ...restDto };
    
    // Convert airDate string to Date if provided
    if (airDate) {
      updateData.airDate = new Date(airDate);
    }
    
    if (dto.number !== undefined || animeId !== undefined) {
      const current = await this.episodeModel.findById(id).select('animeId').lean().exec();
      if (!current) throw new NotFoundException('Episode not found');
      const newAnimeId = animeId ? new Types.ObjectId(animeId) : (current as EpisodeDocument).animeId;
      const newNumber = dto.number ?? undefined;
      if (newNumber !== undefined) {
        const dup = await this.episodeModel.exists({ _id: { $ne: id }, animeId: newAnimeId, number: newNumber }).lean();
        if (dup) throw new ConflictException('Episode number already exists for this anime');
      }
      if (animeId) {
        updateData.animeId = newAnimeId;
      }
    }
    
    const doc = await this.episodeModel.findByIdAndUpdate(id, updateData, { new: true }).lean().exec();
    if (!doc) throw new NotFoundException('Episode not found');
    return doc;
  }

  async remove(id: string) {
    const res = await this.episodeModel.findByIdAndDelete(id).lean().exec();
    if (!res) throw new NotFoundException('Episode not found');
    return { deleted: true } as const;
  }

  async uploadVideo(id: string, file: Multer.File) {
    // Validate episode exists
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    // Validate file type
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!file.mimetype || !allowedVideoTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid video file type. Allowed types: mp4, webm, mov, avi');
    }

    // Validate file size (e.g., max 2GB)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
      throw new BadRequestException('Video file too large. Maximum size is 2GB');
    }

    // Delete old video if exists
    if (episode.videoUrl) {
      const oldKey = this.s3Service.extractKeyFromUrl(episode.videoUrl);
      if (oldKey) {
        try {
          await this.s3Service.deleteFile(oldKey);
        } catch (error) {
          // Log error but don't fail the upload
          console.error('Failed to delete old video:', error);
        }
      }
    }

    // Upload to S3
    const videoUrl = await this.s3Service.uploadVideo(file.buffer, id, file.originalname);

    // Update episode with new video URL
    const updated = await this.episodeModel.findByIdAndUpdate(
      id,
      { videoUrl },
      { new: true },
    ).lean().exec();

    // Trigger HLS transcoding asynchronously (don't wait for it)
    // In production, you might want to use a queue system (Bull, SQS, etc.)
    this.startHLSTranscoding(id, videoUrl, ['360p', '480p', '720p', '1080p']).catch((error) => {
      console.error(`Failed to start HLS transcoding for episode ${id}:`, error);
    });

    return {
      id: updated!._id,
      videoUrl: updated!.videoUrl,
      message: 'Video uploaded successfully. HLS transcoding started in background.',
    };
  }

  async uploadThumbnail(id: string, file: Multer.File) {
    // Validate episode exists
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!file.mimetype || !allowedImageTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image file type. Allowed types: jpeg, jpg, png, webp');
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Thumbnail file too large. Maximum size is 10MB');
    }

    // Delete old thumbnail if exists
    if (episode.thumbnailUrl) {
      const oldKey = this.s3Service.extractKeyFromUrl(episode.thumbnailUrl);
      if (oldKey) {
        try {
          await this.s3Service.deleteFile(oldKey);
        } catch (error) {
          // Log error but don't fail the upload
          console.error('Failed to delete old thumbnail:', error);
        }
      }
    }

    // Upload to S3
    const thumbnailUrl = await this.s3Service.uploadThumbnail(file.buffer, id, file.originalname);

    // Update episode with new thumbnail URL
    const updated = await this.episodeModel.findByIdAndUpdate(
      id,
      { thumbnailUrl },
      { new: true },
    ).lean().exec();

    return {
      id: updated!._id,
      thumbnailUrl: updated!.thumbnailUrl,
      message: 'Thumbnail uploaded successfully',
    };
  }

  /**
   * Get video stream for episode
   * @param id - Episode ID
   * @param range - Range header value
   * @returns Stream data and metadata
   */
  async getVideoStream(id: string, range?: string): Promise<{
    stream: Readable;
    start: number;
    end: number;
    contentLength: number;
    contentType: string;
    isRangeRequest: boolean;
  }> {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    if (!episode.videoUrl) {
      throw new NotFoundException('Video not found for this episode');
    }

    const key = this.s3Service.extractKeyFromUrl(episode.videoUrl);
    if (!key) {
      throw new BadRequestException('Invalid video URL');
    }

    return this.s3Service.streamVideo(key, range);
  }

  /**
   * Get presigned URL for video streaming
   * @param id - Episode ID
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async getVideoUrl(id: string, expiresIn?: number): Promise<{ videoUrl: string; expiresIn: number }> {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    if (!episode.videoUrl) {
      throw new NotFoundException('Video not found for this episode');
    }

    const key = this.s3Service.extractKeyFromUrl(episode.videoUrl);
    if (!key) {
      throw new BadRequestException('Invalid video URL');
    }

    const defaultExpiresIn = expiresIn || 3600; // 1 hour default
    const presignedUrl = await this.s3Service.getVideoPresignedUrl(key, defaultExpiresIn);

    return {
      videoUrl: presignedUrl,
      expiresIn: defaultExpiresIn,
    };
  }

  /**
   * Get HLS master manifest
   * @param id - Episode ID
   * @returns Master manifest content
   */
  async getHLSMasterManifest(id: string): Promise<string> {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    if (!episode.hlsManifestUrl && !episode.hlsVariants) {
      throw new NotFoundException('HLS manifest not found for this episode');
    }

    // If we have a stored manifest URL, fetch it from S3
    if (episode.hlsManifestUrl) {
      const key = this.s3Service.extractKeyFromUrl(episode.hlsManifestUrl);
      if (key) {
        try {
          const streamData = await this.s3Service.streamVideo(key);
          const chunks: Buffer[] = [];
          for await (const chunk of streamData.stream) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks).toString('utf-8');
        } catch (error) {
          // Fall through to generate manifest
        }
      }
    }

    // Generate manifest from variants
    if (episode.hlsVariants) {
      const variants = Object.entries(episode.hlsVariants).map(([quality, variant]) => ({
        manifestUrl: variant.manifestUrl,
        resolution: variant.resolution,
        bandwidth: variant.bandwidth,
        codecs: variant.codecs,
        frameRate: variant.frameRate,
      }));

      // Get base URL from first variant
      const baseUrl = episode.hlsManifestUrl 
        ? episode.hlsManifestUrl.substring(0, episode.hlsManifestUrl.lastIndexOf('/'))
        : undefined;

      return this.hlsService.generateMasterManifest(variants, baseUrl);
    }

    throw new NotFoundException('HLS manifest not found for this episode');
  }

  /**
   * Get HLS variant manifest for a specific quality
   * @param id - Episode ID
   * @param quality - Quality level (e.g., "360p", "720p")
   * @returns Variant manifest content
   */
  async getHLSVariantManifest(id: string, quality: string): Promise<string> {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    if (!episode.hlsVariants || !episode.hlsVariants[quality]) {
      throw new NotFoundException(`HLS variant manifest for quality ${quality} not found`);
    }

    const variant = episode.hlsVariants[quality];
    const key = this.s3Service.extractKeyFromUrl(variant.manifestUrl);
    
    if (!key) {
      throw new BadRequestException('Invalid variant manifest URL');
    }

    try {
      const streamData = await this.s3Service.streamVideo(key);
      const chunks: Buffer[] = [];
      for await (const chunk of streamData.stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf-8');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new NotFoundException(`Failed to fetch variant manifest: ${errorMessage}`);
    }
  }

  /**
   * Get HLS segment file
   * @param id - Episode ID
   * @param quality - Quality level
   * @param segment - Segment filename
   * @returns Segment stream data
   */
  async getHLSSegment(id: string, quality: string, segment: string): Promise<{ stream: Readable }> {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    // Construct segment key
    const segmentKey = `hls/episodes/${id}/${quality}/${segment}`;

    try {
      const streamData = await this.s3Service.streamVideo(segmentKey);
      return { stream: streamData.stream };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new NotFoundException(`Segment not found: ${errorMessage}`);
    }
  }

  /**
   * Start HLS transcoding for uploaded video
   * @param id - Episode ID
   * @param videoUrl - Source video URL
   * @param qualities - Array of quality levels to generate
   * @returns Transcoding job information
   */
  async startHLSTranscoding(
    id: string,
    videoUrl: string,
    qualities: string[] = ['360p', '480p', '720p', '1080p'],
  ) {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    // Start transcoding job
    const job = await this.transcodingService.startTranscodingJob(id, videoUrl, qualities);

    // Store job ID in episode
    await this.episodeModel.findByIdAndUpdate(id, {
      $set: { 'extra.transcodingJobId': job.jobId, 'extra.transcodingStatus': 'processing' },
    });

    return job;
  }

  /**
   * Check transcoding job status and update episode if completed
   * @param id - Episode ID
   * @returns Job status
   */
  async checkTranscodingStatus(id: string) {
    const episode = await this.episodeModel.findById(id).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    const jobId = (episode.extra as { transcodingJobId?: string })?.transcodingJobId;
    if (!jobId) {
      throw new BadRequestException('No transcoding job found for this episode');
    }

    const result = await this.transcodingService.getJobStatus(jobId);

    // If job completed, update episode with HLS manifest URLs
    if (result.status === 'completed' && result.hlsManifestUrl && result.variants) {
      const hlsVariants: Record<string, {
        manifestUrl: string;
        resolution: string;
        bandwidth: number;
      }> = {};
      for (const variant of result.variants) {
        hlsVariants[variant.quality] = {
          manifestUrl: variant.manifestUrl,
          resolution: variant.resolution,
          bandwidth: variant.bandwidth,
        };
      }

      await this.episodeModel.findByIdAndUpdate(id, {
        $set: {
          hlsManifestUrl: result.hlsManifestUrl,
          hlsVariants,
          'extra.transcodingStatus': 'completed',
        },
      });

      return {
        ...result,
        episodeUpdated: true,
      };
    }

    // Update status if failed
    if (result.status === 'failed') {
      await this.episodeModel.findByIdAndUpdate(id, {
        $set: { 'extra.transcodingStatus': 'failed', 'extra.transcodingError': result.error },
      });
    }

    return result;
  }

  /**
   * Handle transcoding job completion callback
   * This should be called from a webhook/CloudWatch event when job completes
   * @param jobId - Transcoding job ID
   */
  async handleTranscodingComplete(jobId: string): Promise<void> {
    this.logger.log(`Handling transcoding completion for job ${jobId}`);

    // Get job status
    const result = await this.transcodingService.getJobStatus(jobId);

    if (result.status === 'completed' && result.hlsManifestUrl && result.variants) {
      // Find episode by job ID
      const episode = await this.episodeModel
        .findOne({ 'extra.transcodingJobId': jobId })
        .lean()
        .exec();

      if (!episode) {
        this.logger.warn(`Episode not found for job ${jobId}`);
        return;
      }

      // Update episode with HLS manifest URLs
      const hlsVariants: Record<string, {
        manifestUrl: string;
        resolution: string;
        bandwidth: number;
      }> = {};
      for (const variant of result.variants) {
        hlsVariants[variant.quality] = {
          manifestUrl: variant.manifestUrl,
          resolution: variant.resolution,
          bandwidth: variant.bandwidth,
        };
      }

      await this.episodeModel.findByIdAndUpdate(episode._id, {
        $set: {
          hlsManifestUrl: result.hlsManifestUrl,
          hlsVariants,
          'extra.transcodingStatus': 'completed',
        },
      });

      this.logger.log(`Episode ${episode._id} updated with HLS manifests`);
    }
  }
}


