// src/payment/dto/webhook-event.dto.ts
import { IsString, IsObject, IsOptional } from 'class-validator';

export class WebhookEventDto {
  @IsString()
  type: string;

  @IsObject()
  data: any;

  @IsString()
  @IsOptional()
  signature?: string;

  @IsString()
  @IsOptional()
  provider?: string;
}