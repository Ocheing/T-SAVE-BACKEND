// src/payment/dto/process-webhook.dto.ts
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class ProcessWebhookDto {
  @IsString()
  transactionId: string;

  @IsString()
  @IsEnum(['success', 'failed', 'pending'])
  status: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  provider?: string;
}