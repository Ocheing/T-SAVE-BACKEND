// src/dashboard/dto/update-preferences.dto.ts
import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsString()
  @IsEnum(['KES', 'USD', 'EUR', 'GBP'])
  currency: string;

  @IsString()
  @IsEnum(['en', 'sw', 'fr'])
  language: string;

  @IsBoolean()
  @IsOptional()
  notifications?: boolean;
}