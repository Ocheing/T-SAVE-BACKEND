import { IsString, IsOptional, IsDate, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToWishlistDto {
  @IsString()
  tripId: string;

  @IsOptional()
  @IsString()
  @IsIn(['high', 'medium', 'low'])
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  targetDate?: Date;
}