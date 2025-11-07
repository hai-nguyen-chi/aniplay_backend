import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HLSService } from './hls.service';

@Module({
  imports: [ConfigModule],
  providers: [HLSService],
  exports: [HLSService],
})
export class HLSModule {}

