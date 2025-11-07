import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION')!,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucketName = this.configService.get<string>('S3_BUCKET')!;
  }

  /**
   * Upload file to S3
   * @param file - File buffer
   * @param key - S3 object key (path)
   * @param contentType - MIME type of the file
   * @returns URL of the uploaded file
   */
  async uploadFile(file: Buffer, key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    
    // Return public URL or presigned URL based on bucket configuration
    // If bucket is public, use direct URL
    // Otherwise, you might want to return a presigned URL
    return `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Upload video file to S3
   * @param file - Video file buffer
   * @param episodeId - Episode ID for organizing files
   * @param filename - Original filename
   * @returns URL of the uploaded video
   */
  async uploadVideo(file: Buffer, episodeId: string, filename: string): Promise<string> {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = sanitizedFilename.split('.').pop() || 'mp4';
    const key = `videos/episodes/${episodeId}/${timestamp}-${sanitizedFilename}`;
    
    return this.uploadFile(file, key, `video/${extension === 'mp4' ? 'mp4' : extension}`);
  }

  /**
   * Upload thumbnail image to S3
   * @param file - Image file buffer
   * @param episodeId - Episode ID for organizing files
   * @param filename - Original filename
   * @returns URL of the uploaded thumbnail
   */
  async uploadThumbnail(file: Buffer, episodeId: string, filename: string): Promise<string> {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = sanitizedFilename.split('.').pop() || 'jpg';
    const key = `thumbnails/episodes/${episodeId}/${timestamp}-${sanitizedFilename}`;
    
    return this.uploadFile(file, key, `image/${extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : extension}`);
  }

  /**
   * Delete file from S3
   * @param key - S3 object key (path)
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Get presigned URL for private file access
   * @param key - S3 object key (path)
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Extract S3 key from URL
   * @param url - S3 URL
   * @returns S3 key
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash from pathname
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * Get object metadata from S3
   * @param key - S3 object key
   * @returns Object metadata including content length and content type
   */
  async getObjectMetadata(key: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType || 'video/mp4',
      lastModified: response.LastModified,
      etag: response.ETag,
    };
  }

  /**
   * Stream video from S3 with range support
   * @param key - S3 object key
   * @param range - Range header value (e.g., "bytes=0-1023")
   * @returns Stream data and range information
   */
  async streamVideo(key: string, range?: string): Promise<{
    stream: Readable;
    start: number;
    end: number;
    contentLength: number;
    contentType: string;
    isRangeRequest: boolean;
  }> {
    // Get object metadata first
    const metadata = await this.getObjectMetadata(key);
    const contentLength = metadata.contentLength || 0;

    if (contentLength === 0) {
      throw new Error('Empty file');
    }

    // Parse range header
    let start = 0;
    let end = contentLength - 1;
    let isRangeRequest = false;

    if (range) {
      isRangeRequest = true;
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      if (isNaN(start)) {
        start = 0;
      }
      end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      if (isNaN(end)) {
        end = contentLength - 1;
      }
    }

    // Validate range
    if (start < 0) start = 0;
    if (end >= contentLength) end = contentLength - 1;
    if (start > end) {
      throw new Error('Invalid range');
    }

    // Create GetObjectCommand with range
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Range: isRangeRequest ? `bytes=${start}-${end}` : undefined,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('No body in S3 response');
    }

    // Convert response body to Readable stream
    const stream = response.Body as Readable;

    return {
      stream,
      start,
      end,
      contentLength,
      contentType: metadata.contentType,
      isRangeRequest,
    };
  }

  /**
   * Get presigned URL for video streaming
   * @param key - S3 object key
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async getVideoPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return this.getPresignedUrl(key, expiresIn);
  }

  /**
   * Upload HLS manifest file to S3
   * @param manifestContent - Manifest file content (.m3u8)
   * @param episodeId - Episode ID
   * @param filename - Manifest filename (e.g., "master.m3u8" or "360p.m3u8")
   * @returns URL of the uploaded manifest
   */
  async uploadHLSManifest(manifestContent: string, episodeId: string, filename: string): Promise<string> {
    const key = `hls/episodes/${episodeId}/${filename}`;
    const buffer = Buffer.from(manifestContent, 'utf-8');
    return this.uploadFile(buffer, key, 'application/vnd.apple.mpegurl');
  }

  /**
   * Upload HLS segment to S3
   * @param segmentBuffer - Segment file buffer (.ts)
   * @param episodeId - Episode ID
   * @param quality - Quality label (e.g., "360p", "720p")
   * @param segmentName - Segment filename (e.g., "segment_000.ts")
   * @returns URL of the uploaded segment
   */
  async uploadHLSSegment(
    segmentBuffer: Buffer,
    episodeId: string,
    quality: string,
    segmentName: string,
  ): Promise<string> {
    const key = `hls/episodes/${episodeId}/${quality}/${segmentName}`;
    return this.uploadFile(segmentBuffer, key, 'video/mp2t');
  }

  /**
   * Get HLS manifest URL
   * @param episodeId - Episode ID
   * @param filename - Manifest filename
   * @returns Public URL of the manifest
   */
  getHLSManifestUrl(episodeId: string, filename: string): string {
    const key = `hls/episodes/${episodeId}/${filename}`;
    return `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Get HLS segment URL
   * @param episodeId - Episode ID
   * @param quality - Quality label
   * @param segmentName - Segment filename
   * @returns Public URL of the segment
   */
  getHLSSegmentUrl(episodeId: string, quality: string, segmentName: string): string {
    const key = `hls/episodes/${episodeId}/${quality}/${segmentName}`;
    return `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Delete HLS files for an episode
   * @param episodeId - Episode ID
   */
  async deleteHLSFiles(episodeId: string): Promise<void> {
    // Note: This is a simplified version. In production, you might want to list all objects
    // with prefix `hls/episodes/${episodeId}/` and delete them
    // For now, we'll rely on S3 lifecycle policies or manual cleanup
    console.log(`HLS files for episode ${episodeId} should be deleted manually or via lifecycle policy`);
  }

  /**
   * Download file from S3 to buffer
   * @param key - S3 object key
   * @returns File buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('No body in S3 response');
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}

