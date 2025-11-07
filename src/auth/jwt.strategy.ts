import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@/users/users.service';
import { JwtUser } from '@/auth/types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<JwtUser | null> {
    // Load fresh permissions from DB for each request
    const user = await this.users.findByIdLeanBasic(payload.sub);
    if (!user) return null;
    return {
      sub: payload.sub,
      email: user.email,
      username: user.username,
      permissions: user.permissions,
    };
  }
}


