import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Episode, EpisodeSchema } from '@/episodes/schemas/episode.schema';
import { EpisodesService } from './episodes.service';
import { EpisodesController } from './episodes.controller';
import { S3Module } from '@/s3/s3.module';
import { HLSModule } from '@/hls/hls.module';
import { TranscodingModule } from '@/transcoding/transcoding.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Episode.name, schema: EpisodeSchema }]),
    S3Module,
    HLSModule,
    TranscodingModule,
  ],
  controllers: [EpisodesController],
  providers: [EpisodesService],
  exports: [EpisodesService],
})
export class EpisodesModule {}


