import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Favorite, FavoriteDocument } from '@/favorites/schemas/favorite.schema';
import { CreateFavoriteDto } from '@/favorites/dto/create-favorite.dto';
import { Anime, AnimeDocument } from '@/anime/schemas/anime.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Anime.name)
    private readonly animeModel: Model<AnimeDocument>,
  ) {}

  async create(userId: string, animeId: string, dto: CreateFavoriteDto) {
    // Validate anime exists
    const anime = await this.animeModel.findById(animeId).lean().exec();
    if (!anime) throw new NotFoundException('Anime not found');

    // Check if already favorited
    const existing = await this.favoriteModel.findOne({ userId, animeId }).lean().exec();
    if (existing) throw new ConflictException('Anime already in favorites');

    const favorite = await this.favoriteModel.create({
      userId,
      animeId,
      notes: dto.notes,
    });

    return favorite.toObject();
  }

  async remove(userId: string, animeId: string) {
    const result = await this.favoriteModel.findOneAndDelete({ userId, animeId }).lean().exec();
    if (!result) throw new NotFoundException('Favorite not found');
    return { deleted: true } as const;
  }

  async findAll(userId: string) {
    const items = await this.favoriteModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .populate('animeId', 'title coverImage slug description genres status year rating')
      .lean()
      .exec();

    return items;
  }

  async isFavorite(userId: string, animeId: string): Promise<boolean> {
    const favorite = await this.favoriteModel.findOne({ userId, animeId }).lean().exec();
    return !!favorite;
  }
}

