import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from '@/comments/schemas/comment.schema';
import { Anime, AnimeSchema } from '@/anime/schemas/anime.schema';
import { Episode, EpisodeSchema } from '@/episodes/schemas/episode.schema';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Anime.name, schema: AnimeSchema },
      { name: Episode.name, schema: EpisodeSchema },
    ]),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}

