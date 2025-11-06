import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, Length, Max, MaxLength, Min } from 'class-validator';
import { AnimeStatus } from '@/anime/schemas/anime.schema';

export class UpdateAnimeDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsEnum(AnimeStatus)
  status?: AnimeStatus;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(3000)
  year?: number;

  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @IsOptional()
  @IsUrl()
  bannerImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studios?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  episodesCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;
}


