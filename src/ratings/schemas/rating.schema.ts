import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type RatingDocument = HydratedDocument<Rating>;

@Schema({ timestamps: true, collection: 'ratings' })
export class Rating {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Anime', required: true, index: true })
  animeId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 10, index: true })
  rating: number; // 1-10

  // added by timestamps option
  createdAt?: Date;
  updatedAt?: Date;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

// Unique compound index: one user can only rate an anime once
RatingSchema.index({ userId: 1, animeId: 1 }, { unique: true });
RatingSchema.index({ animeId: 1, rating: 1 }); // For calculating average rating

