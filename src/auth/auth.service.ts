import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '@/users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '@/users/users.service';
import { Action } from '@/auth/permissions';
import { RegisterDto } from '@/auth/dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async signAccessToken(user: UserDocument): Promise<string> {
    const payload = { sub: user._id.toString(), email: user.email };
    return await this.jwtService.signAsync(payload);
  }

  async signRefreshToken(userId: string): Promise<string> {
    const secret = this.config.get<string>('REFRESH_JWT_SECRET') as string;
    const expiresIn = Number(this.config.get<string>('REFRESH_JWT_EXPIRES_IN')) || 604800; // 7d in seconds
    return await this.jwtService.signAsync({ sub: userId }, { secret, expiresIn });
  }

  async setRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.users.setRefreshTokenHash(userId, hash);
  }

  async removeRefreshTokenHash(userId: string): Promise<void> {
    await this.users.removeRefreshTokenHash(userId);
  }

  async rotateTokens(user: UserDocument) {
    const userId = user._id.toString();
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.signRefreshToken(userId);
    await this.setRefreshTokenHash(userId, refreshToken);
    return { accessToken, refreshToken };
  }

  async verifyRefreshToken(refreshToken: string): Promise<UserDocument> {
    const secret = this.config.get<string>('REFRESH_JWT_SECRET') as string;
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findByIdWithRefreshHash(payload.sub);
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('Invalid refresh token');
    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Invalid refresh token');
    return user;
  }

  async register(dto: RegisterDto) {
    const exists = await this.users.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const permissions: Record<string, number> = { '*': Action.View };
    const user = await this.users.createOne({
      email: dto.email,
      username: dto.username,
      passwordHash,
      permissions,
    });
    return await this.rotateTokens(user);
  }
}


