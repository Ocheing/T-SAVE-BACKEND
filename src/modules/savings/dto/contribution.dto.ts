import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class ContributionDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @IsIn(['manual', 'auto-debit', 'mpesa', 'card', 'bank'])
  method?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}