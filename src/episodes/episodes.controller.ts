import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto } from '@/episodes/dto/create-episode.dto';
import { UpdateEpisodeDto } from '@/episodes/dto/update-episode.dto';
import { QueryEpisodeDto } from '@/episodes/dto/query-episode.dto';
import { JwtAuthGuard } from '@/auth/jwt.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { RequirePermissions } from '@/auth/permissions.decorator';
import { Action, Resource } from '@/auth/permissions';
import { Response } from 'express';

@Controller('episodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EpisodesController {
  constructor(private readonly episodes: EpisodesService) {}

  @Get()
  @RequirePermissions(Resource.Episode, Action.View)
  findAll(@Query() query: QueryEpisodeDto) {
    return this.episodes.findAll(query);
  }

  @Get(':id/stream')
  @RequirePermissions(Resource.Episode, Action.View)
  async streamVideo(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const streamData = await this.episodes.getVideoStream(id, range);

      const { stream, start, end, contentLength, contentType, isRangeRequest } = streamData;
      const chunkSize = end - start + 1;

      // Set common headers
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (isRangeRequest) {
        // Partial content response
        res.status(206); // Partial Content
        res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
        res.setHeader('Content-Length', chunkSize);
      } else {
        // Full content response
        res.status(200);
        res.setHeader('Content-Length', contentLength);
      }

      // Pipe stream to response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error: Error) => {
        if (!res.headersSent) {
          res.status(500).json({ message: 'Stream error', error: error.message });
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Invalid range' || errorMessage === 'Empty file') {
        res.status(416).json({ message: 'Range Not Satisfiable' });
      } else if (!res.headersSent) {
        throw error;
      }
    }
  }

  @Get(':id/video-url')
  @RequirePermissions(Resource.Episode, Action.View)
  async getVideoUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const expiresInSeconds = expiresIn ? parseInt(expiresIn, 10) : undefined;
    return this.episodes.getVideoUrl(id, expiresInSeconds);
  }

  // HLS Streaming Endpoints
  @Get(':id/hls/master.m3u8')
  @RequirePermissions(Resource.Episode, Action.View)
  async getHLSMasterManifest(@Param('id') id: string, @Res() res: Response) {
    try {
      const manifest = await this.episodes.getHLSMasterManifest(id);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(manifest);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage?.includes('not found')) {
        res.status(404).json({ message: errorMessage });
      } else {
        throw error;
      }
    }
  }

  @Get(':id/hls/:quality.m3u8')
  @RequirePermissions(Resource.Episode, Action.View)
  async getHLSVariantManifest(
    @Param('id') id: string,
    @Param('quality') quality: string,
    @Res() res: Response,
  ) {
    try {
      const manifest = await this.episodes.getHLSVariantManifest(id, quality);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(manifest);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage?.includes('not found')) {
        res.status(404).json({ message: errorMessage });
      } else {
        throw error;
      }
    }
  }

  @Get(':id/hls/:quality/:segment')
  @RequirePermissions(Resource.Episode, Action.View)
  async getHLSSegment(
    @Param('id') id: string,
    @Param('quality') quality: string,
    @Param('segment') segment: string,
    @Res() res: Response,
  ) {
    try {
      const streamData = await this.episodes.getHLSSegment(id, quality, segment);
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache segments longer
      streamData.stream.pipe(res);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage?.includes('not found')) {
        res.status(404).json({ message: errorMessage });
      } else {
        throw error;
      }
    }
  }

  @Get(':id')
  @RequirePermissions(Resource.Episode, Action.View)
  findOne(@Param('id') id: string) {
    return this.episodes.findOne(id);
  }

  @Post()
  @RequirePermissions(Resource.Episode, Action.Create)
  create(@Body() dto: CreateEpisodeDto) {
    return this.episodes.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Resource.Episode, Action.Update)
  update(@Param('id') id: string, @Body() dto: UpdateEpisodeDto) {
    return this.episodes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Resource.Episode, Action.Delete)
  remove(@Param('id') id: string) {
    return this.episodes.remove(id);
  }

  @Post(':id/upload-video')
  @RequirePermissions(Resource.Episode, Action.Update)
  @UseInterceptors(FileInterceptor('video'))
  async uploadVideo(@Param('id') id: string, @UploadedFile() file: Multer.File) {
    if (!file) {
      throw new BadRequestException('No video file provided');
    }
    return this.episodes.uploadVideo(id, file);
  }

  @Post(':id/upload-thumbnail')
  @RequirePermissions(Resource.Episode, Action.Update)
  @UseInterceptors(FileInterceptor('thumbnail'))
  async uploadThumbnail(@Param('id') id: string, @UploadedFile() file: Multer.File) {
    if (!file) {
      throw new BadRequestException('No thumbnail file provided');
    }
    return this.episodes.uploadThumbnail(id, file);
  }

  // HLS Transcoding Endpoints
  @Post(':id/transcode')
  @RequirePermissions(Resource.Episode, Action.Update)
  async startTranscoding(
    @Param('id') id: string,
    @Query('qualities') qualities?: string,
  ) {
    const qualityList = qualities ? qualities.split(',') : ['360p', '480p', '720p', '1080p'];
    
    const episode = await this.episodes.findOne(id);
    if (!episode.videoUrl) {
      throw new BadRequestException('No video uploaded for this episode');
    }

    return this.episodes.startHLSTranscoding(id, episode.videoUrl, qualityList);
  }

  @Get(':id/transcode/status')
  @RequirePermissions(Resource.Episode, Action.View)
  async getTranscodingStatus(@Param('id') id: string) {
    return this.episodes.checkTranscodingStatus(id);
  }

  // Webhook endpoint for transcoding job completion (should be protected in production)
  @Post('transcode/callback')
  async handleTranscodingCallback(@Body() body: { detail?: { jobId?: string }; jobId?: string }) {
    // For FFmpeg: Can be called manually or via queue system
    // This endpoint should be called by a queue worker or scheduled job
    const jobId = body.detail?.jobId || body.jobId;
    if (!jobId) {
      throw new BadRequestException('Job ID not found in callback');
    }

    await this.episodes.handleTranscodingComplete(jobId);
    return { success: true, jobId };
  }
}


