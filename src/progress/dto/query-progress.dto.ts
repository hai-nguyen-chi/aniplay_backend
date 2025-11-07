import { IsMongoId, IsOptional } from 'class-validator';

export class QueryProgressDto {
  @IsOptional()
  @IsMongoId()
  animeId?: string;
}

