import { IsDateString, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Length, MaxLength, Min } from 'class-validator';

export class UpdateEpisodeDto {
  @IsOptional()
  @IsMongoId()
  animeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  number?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsDateString()
  airDate?: string;
}


