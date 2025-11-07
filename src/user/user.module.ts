import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { ProgressModule } from '@/progress/progress.module';

@Module({
  imports: [ProgressModule],
  controllers: [UserController],
})
export class UserModule {}

