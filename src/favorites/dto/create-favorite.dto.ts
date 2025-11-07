import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFavoriteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

