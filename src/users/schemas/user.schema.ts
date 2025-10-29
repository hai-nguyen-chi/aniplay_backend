import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// Resource-based permissions are stored per resource as bitmasks

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true,
  })
  email: string;

  @Prop({ type: String, required: true, minlength: 6, select: false })
  password: string;

  @Prop({ type: String, required: true, trim: true })
  username: string;

  // Permissions per resource, e.g., { anime: 1, rating: 1, comment: 3 }
  @Prop({ type: Map, of: Number, default: {} })
  permissions: Map<string, number>;

  // Hashed refresh token for current session (optional)
  @Prop({ type: String, select: false, required: false })
  refreshTokenHash?: string;

  // added by timestamps option
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });




