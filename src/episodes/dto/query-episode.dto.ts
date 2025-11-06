import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';

export class QueryEpisodeDto {
  @IsOptional()
  @IsMongoId()
  animeId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}


