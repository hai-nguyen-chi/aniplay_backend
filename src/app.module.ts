import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from '@/users/schemas/user.schema';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { AnimeModule } from '@/anime/anime.module';
import { EpisodesModule } from '@/episodes/episodes.module';
import { ProgressModule } from '@/progress/progress.module';
import { FavoritesModule } from '@/favorites/favorites.module';
import { RatingsModule } from '@/ratings/ratings.module';
import { CommentsModule } from '@/comments/comments.module';
import { UserModule } from '@/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // cho phép dùng ở mọi nơi mà không cần import lại
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      dbName: 'aniplay'
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UsersModule,
    AuthModule,
    AnimeModule,
    EpisodesModule,
    ProgressModule,
    FavoritesModule,
    RatingsModule,
    CommentsModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
