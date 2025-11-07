import { IsInt, IsMongoId, Min } from 'class-validator';

export class CreateProgressDto {
  @IsMongoId()
  animeId: string;

  @IsMongoId()
  episodeId: string;

  @IsInt()
  @Min(0)
  currentTime: number; // seconds watched

  @IsInt()
  @Min(0)
  duration: number; // total duration in seconds
}

