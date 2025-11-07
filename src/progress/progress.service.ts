import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { UserAnimeProgress, UserAnimeProgressDocument } from '@/progress/schemas/user-anime-progress.schema';
import { CreateProgressDto } from '@/progress/dto/create-progress.dto';
import { QueryProgressDto } from '@/progress/dto/query-progress.dto';
import { Anime, AnimeDocument } from '@/anime/schemas/anime.schema';
import { Episode, EpisodeDocument } from '@/episodes/schemas/episode.schema';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(UserAnimeProgress.name)
    private readonly progressModel: Model<UserAnimeProgressDocument>,
    @InjectModel(Anime.name)
    private readonly animeModel: Model<AnimeDocument>,
    @InjectModel(Episode.name)
    private readonly episodeModel: Model<EpisodeDocument>,
  ) {}

  async create(userId: string, dto: CreateProgressDto) {
    // Validate anime and episode exist
    const anime = await this.animeModel.findById(dto.animeId).lean().exec();
    if (!anime) throw new NotFoundException('Anime not found');

    const episode = await this.episodeModel.findById(dto.episodeId).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    // Validate episode belongs to anime
    if (episode.animeId.toString() !== dto.animeId) {
      throw new NotFoundException('Episode does not belong to this anime');
    }

    // Calculate progress percentage
    const progressPercentage = dto.duration > 0 
      ? Math.min(100, Math.round((dto.currentTime / dto.duration) * 100))
      : 0;

    // Upsert progress (update if exists, create if not)
    const progress = await this.progressModel.findOneAndUpdate(
      { userId, animeId: dto.animeId },
      {
        userId,
        animeId: dto.animeId,
        episodeId: dto.episodeId,
        currentTime: dto.currentTime,
        duration: dto.duration,
        progressPercentage,
        lastWatchedAt: new Date(),
      },
      { upsert: true, new: true },
    ).lean().exec();

    return progress;
  }

  async findAll(userId: string, query: QueryProgressDto) {
    const filter: FilterQuery<UserAnimeProgressDocument> = { userId };
    if (query.animeId) {
      filter.animeId = query.animeId;
    }

    const items = await this.progressModel
      .find(filter)
      .sort({ lastWatchedAt: -1 })
      .populate('animeId', 'title coverImage slug')
      .populate('episodeId', 'title number thumbnailUrl')
      .lean()
      .exec();

    return items;
  }

  async getContinueWatching(userId: string, limit: number = 10) {
    const items = await this.progressModel
      .find({ userId })
      .sort({ lastWatchedAt: -1 })
      .limit(limit)
      .populate('animeId', 'title coverImage slug')
      .populate('episodeId', 'title number thumbnailUrl')
      .lean()
      .exec();

    return items;
  }
}

