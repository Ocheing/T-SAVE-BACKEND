// src/dashboard/dto/quiz-preferences.dto.ts
import { IsString, IsArray, IsEnum, IsOptional } from 'class-validator';

export class QuizPreferencesDto {
  @IsString()
  @IsEnum(['adventure', 'relaxation', 'cultural', 'romantic', 'family'])
  travelStyle: string;

  @IsString()
  @IsEnum(['budget', 'mid-range', 'luxury'])
  budgetRange: string;

  @IsArray()
  @IsString({ each: true })
  activities: string[];

  @IsString()
  @IsEnum(['solo', 'couple', 'family', 'group'])
  groupSize: string;

  @IsString()
  @IsEnum(['tropical', 'temperate', 'arid', 'cold'])
  climate: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  destinations?: string[];
}