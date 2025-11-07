import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true, collection: 'comments' })
export class Comment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Anime', index: true })
  animeId?: Types.ObjectId; // null if episode comment

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Episode', index: true })
  episodeId?: Types.ObjectId; // null if anime comment

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comment' })
  parentId?: Types.ObjectId; // for replies

  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 5000 })
  content: string;

  @Prop({ type: Number, default: 0, min: 0 })
  likes: number;

  // added by timestamps option
  createdAt?: Date;
  updatedAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Indexes for efficient queries
CommentSchema.index({ animeId: 1, createdAt: -1 }); // For anime comments
CommentSchema.index({ episodeId: 1, createdAt: -1 }); // For episode comments
CommentSchema.index({ parentId: 1, createdAt: -1 }); // For replies
CommentSchema.index({ userId: 1, createdAt: -1 }); // For user's comments

