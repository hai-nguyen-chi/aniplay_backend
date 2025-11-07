import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserAnimeProgress, UserAnimeProgressSchema } from '@/progress/schemas/user-anime-progress.schema';
import { Anime, AnimeSchema } from '@/anime/schemas/anime.schema';
import { Episode, EpisodeSchema } from '@/episodes/schemas/episode.schema';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserAnimeProgress.name, schema: UserAnimeProgressSchema },
      { name: Anime.name, schema: AnimeSchema },
      { name: Episode.name, schema: EpisodeSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}

