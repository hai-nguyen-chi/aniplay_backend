import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TranscodingService } from './transcoding.service';
import { S3Module } from '@/s3/s3.module';
import { HLSModule } from '@/hls/hls.module';

@Module({
  imports: [ConfigModule, S3Module, HLSModule],
  providers: [TranscodingService],
  exports: [TranscodingService],
})
export class TranscodingModule {}

