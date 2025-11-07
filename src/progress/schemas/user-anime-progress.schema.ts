import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type UserAnimeProgressDocument = HydratedDocument<UserAnimeProgress>;

@Schema({ timestamps: true, collection: 'useranimeprogress' })
export class UserAnimeProgress {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Anime', required: true, index: true })
  animeId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Episode', required: true, index: true })
  episodeId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  currentTime: number; // seconds watched

  @Prop({ type: Number, required: true, min: 0 })
  duration: number; // total duration in seconds

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  progressPercentage: number; // 0-100

  @Prop({ type: Date, default: Date.now, index: true })
  lastWatchedAt: Date;

  // added by timestamps option
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserAnimeProgressSchema = SchemaFactory.createForClass(UserAnimeProgress);

// Unique compound index: one user can only have one progress per anime
UserAnimeProgressSchema.index({ userId: 1, animeId: 1 }, { unique: true });
UserAnimeProgressSchema.index({ userId: 1, lastWatchedAt: -1 }); // For sorting by last watched

