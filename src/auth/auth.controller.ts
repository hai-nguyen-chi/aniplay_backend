import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import { Response } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { LoginDto, RefreshDto, RegisterDto } from '@/auth/dto/auth.dto';
import { AuthenticatedRequest } from '@/auth/types/request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const { accessToken, refreshToken } = await this.auth.rotateTokens(user);
    return { accessToken, refreshToken };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const { accessToken, refreshToken } = await this.auth.register(dto);
    return { accessToken, refreshToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    const user = await this.auth.verifyRefreshToken(dto.refreshToken);
    const { accessToken, refreshToken } = await this.auth.rotateTokens(user);
    return { accessToken, refreshToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest) {
    await this.auth.removeRefreshTokenHash(req.user.sub);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}


