import { IsMongoId, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 5000)
  content: string;

  @IsOptional()
  @IsMongoId()
  parentId?: string; // for replies
}

