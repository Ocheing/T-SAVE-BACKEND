// src/ai/dto/create-conversation.dto.ts
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  initialMessage?: string;

  @IsOptional()
  @IsObject()
  preferences?: {
    budgetRange?: string;
    category?: string;
    duration?: number;
    groupSize?: string;
    destination?: string;
    activities?: string[];
  };
}