import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@/users/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  findByIdLeanBasic(id: string) {
    return this.userModel.findById(id).select('email username permissions').lean().exec();
  }

  findByIdWithRefreshHash(id: string) {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async setRefreshTokenHash(userId: string, hash: string) {
    await this.userModel.updateOne({ _id: userId }, { $set: { refreshTokenHash: hash } }).exec();
  }

  async removeRefreshTokenHash(userId: string) {
    await this.userModel.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } }).exec();
  }

  async createOne(params: { email: string; username: string; passwordHash: string; permissions?: Record<string, number> }) {
    const doc = new this.userModel({
      email: params.email,
      username: params.username,
      password: params.passwordHash,
      permissions: params.permissions ?? {},
    });
    return await doc.save();
  }
}


