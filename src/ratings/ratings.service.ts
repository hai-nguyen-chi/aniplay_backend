import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rating, RatingDocument } from '@/ratings/schemas/rating.schema';
import { CreateRatingDto } from '@/ratings/dto/create-rating.dto';
import { Anime, AnimeDocument } from '@/anime/schemas/anime.schema';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(Anime.name)
    private readonly animeModel: Model<AnimeDocument>,
  ) {}

  async create(userId: string, animeId: string, dto: CreateRatingDto) {
    // Validate anime exists
    const anime = await this.animeModel.findById(animeId).lean().exec();
    if (!anime) throw new NotFoundException('Anime not found');

    // Check if already rated
    const existing = await this.ratingModel.findOne({ userId, animeId }).lean().exec();
    if (existing) {
      // Update existing rating
      const updated = await this.ratingModel.findByIdAndUpdate(
        existing._id,
        { rating: dto.rating },
        { new: true },
      ).lean().exec();

      // Recalculate average rating
      await this.updateAnimeRating(animeId);

      return updated;
    }

    // Create new rating
    const rating = await this.ratingModel.create({
      userId,
      animeId,
      rating: dto.rating,
    });

    // Recalculate average rating
    await this.updateAnimeRating(animeId);

    return rating.toObject();
  }

  async getRating(animeId: string, userId?: string) {
    // Validate anime exists
    const anime = await this.animeModel.findById(animeId).lean().exec();
    if (!anime) throw new NotFoundException('Anime not found');

    // Get all ratings for this anime
    const ratings = await this.ratingModel.find({ animeId }).lean().exec();

    // Calculate average
    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;

    // Get user's rating if provided
    let userRating: number | undefined;
    if (userId) {
      const userRatingDoc = ratings.find(r => r.userId.toString() === userId);
      userRating = userRatingDoc?.rating;
    }

    return {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      userRating,
      totalRatings,
    };
  }

  private async updateAnimeRating(animeId: string) {
    // Get all ratings for this anime
    const ratings = await this.ratingModel.find({ animeId }).lean().exec();

    // Calculate average
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Update anime rating
    await this.animeModel.findByIdAndUpdate(animeId, {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    });
  }
}

