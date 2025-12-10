import { IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class PaymentDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  provider: string;

  @IsString()
  reference: string;

  @IsOptional()
  @IsString()
  @IsIn(['savings', 'mpesa', 'card', 'bank'])
  method?: string;
}