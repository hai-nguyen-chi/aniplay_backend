import { IsInt, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @IsInt()
  @Min(1)
  @Max(10)
  rating: number; // 1-10
}

