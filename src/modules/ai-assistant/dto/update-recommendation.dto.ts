// src/ai/dto/update-recommendation.dto.ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRecommendationDto {
  @IsOptional()
  @IsBoolean()
  isSaved?: boolean;

  @IsOptional()
  @IsString()
  feedback?: 'liked' | 'disliked' | 'saved';
}