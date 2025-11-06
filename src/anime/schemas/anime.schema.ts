import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export type AnimeDocument = HydratedDocument<Anime>;

export enum AnimeStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  HIATUS = 'hiatus',
  ANNOUNCED = 'announced',
}

@Schema({ timestamps: true, collection: 'anime' })
export class Anime {
  @Prop({ type: String, required: true, trim: true, index: true })
  title: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true, unique: true, index: true })
  slug: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: [String], default: [] })
  genres: string[];

  @Prop({ type: String, enum: Object.values(AnimeStatus), default: AnimeStatus.ONGOING })
  status: AnimeStatus;

  @Prop({ type: Number, min: 1900, max: 3000 })
  year?: number;

  @Prop({ type: String })
  coverImage?: string;

  @Prop({ type: String })
  bannerImage?: string;

  @Prop({ type: [String], default: [] })
  studios: string[];

  @Prop({ type: Number, default: 0, min: 0 })
  episodesCount: number;

  @Prop({ type: Number, default: 0, min: 0, max: 10 })
  rating: number;

  @Prop({ type: SchemaTypes.Mixed })
  extra?: Record<string, any>;
}

export const AnimeSchema = SchemaFactory.createForClass(Anime);


