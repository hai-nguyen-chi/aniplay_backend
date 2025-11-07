import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type EpisodeDocument = HydratedDocument<Episode>;

@Schema({ timestamps: true, collection: 'episodes' })
export class Episode {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Anime', required: true, index: true })
  animeId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: Number, required: true, min: 0, index: true })
  number: number;

  @Prop({ type: String, trim: true })
  synopsis?: string;

  @Prop({ type: String })
  videoUrl?: string; // Deprecated, giữ lại để backward compatibility

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: Number, min: 0 })
  durationSec?: number;

  @Prop({ type: Date })
  airDate?: Date;

  // HLS streaming support
  @Prop({ type: String })
  hlsManifestUrl?: string; // Master manifest URL (.m3u8)

  @Prop({ type: SchemaTypes.Mixed })
  hlsVariants?: {
    [quality: string]: {
      manifestUrl: string; // Variant manifest URL
      resolution: string; // "360p", "480p", "720p", "1080p"
      bandwidth: number; // bits per second
      codecs?: string; // "avc1.42e01e,mp4a.40.2"
      frameRate?: number;
    };
  };

  @Prop({ type: SchemaTypes.Mixed })
  extra?: Record<string, unknown>;
}

export const EpisodeSchema = SchemaFactory.createForClass(Episode);

EpisodeSchema.index({ animeId: 1, number: 1 }, { unique: true });


