import { IsString, IsNumber, IsOptional, IsDate, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @IsString()
  tripId: string;

  @IsString()
  @IsIn(['flight', 'hotel', 'package', 'activity', 'transport'])
  type: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  cost: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  travelDate?: Date;

  @IsOptional()
  @IsString()
  @IsIn(['savings', 'mpesa', 'card', 'bank'])
  paymentMethod?: string;
}