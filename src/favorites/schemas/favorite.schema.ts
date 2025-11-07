import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({ timestamps: true, collection: 'favorites' })
export class Favorite {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Anime', required: true, index: true })
  animeId: Types.ObjectId;

  @Prop({ type: String, trim: true })
  notes?: string; // optional, user's personal notes

  // added by timestamps option
  createdAt?: Date;
  updatedAt?: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Unique compound index: one user can only favorite an anime once
FavoriteSchema.index({ userId: 1, animeId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, createdAt: -1 }); // For sorting by date added

