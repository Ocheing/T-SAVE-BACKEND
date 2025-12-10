import { IsString, IsNumber, IsOptional, IsDate, IsIn, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSavingDto {
  @IsString()
  title: string;

  @IsNumber()
  @Min(0)
  targetAmount: number;

  @IsString()
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  frequency: string;

  @IsNumber()
  @Min(0)
  amountPerFrequency: number;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  targetDate: Date;

  @IsOptional()
  @IsString()
  tripId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}