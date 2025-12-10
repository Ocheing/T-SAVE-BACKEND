// src/notifications/dto/update-settings.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  savingsReminders?: boolean;

  @IsBoolean()
  @IsOptional()
  upcomingTripAlerts?: boolean;

  @IsBoolean()
  @IsOptional()
  achievementCelebrations?: boolean;

  @IsBoolean()
  @IsOptional()
  marketingEmails?: boolean;

  @IsBoolean()
  @IsOptional()
  pushNotifications?: boolean;
}