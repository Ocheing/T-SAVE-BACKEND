// src/payment/dto/initiate-payment.dto.ts
import { IsString, IsNumber, IsEnum, IsOptional, IsPositive } from 'class-validator';

export class InitiatePaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsEnum(['savings_contribution', 'booking_payment', 'refund'])
  type: string;

  @IsString()
  @IsEnum(['mpesa', 'card', 'bank'])
  provider: string;

  @IsString()
  @IsOptional()
  @IsEnum(['savings', 'travel', 'accommodation'])
  category?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  savingId?: string;

  @IsString()
  @IsOptional()
  bookingId?: string;
}