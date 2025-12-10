import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { AIService } from './ai.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto';

@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  // ===== CONVERSATIONS =====

  @UseGuards(JwtAuthGuard)
  @Post('conversations')
  async createConversation(
    @Request() req,
    @Body(ValidationPipe) createConversationDto: CreateConversationDto,
  ) {
    return this.aiService.createConversation(req.user.userId, createConversationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  async getUserConversations(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.aiService.getUserConversations(req.user.userId, { page, limit }); // Fixed: pass as object
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id')
  async getConversationById(@Request() req, @Param('id') id: string) {
    return this.aiService.getConversationById(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/messages')
  async sendMessage(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) sendMessageDto: SendMessageDto,
  ) {
    return this.aiService.sendMessage(req.user.userId, id, sendMessageDto);
  }

  // ===== RECOMMENDATIONS =====

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/recommendations')
  async getConversationRecommendations(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.aiService.getConversationRecommendations(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('recommendations/:id')
  async updateRecommendation(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) updateRecommendationDto: UpdateRecommendationDto,
  ) {
    return this.aiService.updateRecommendation(req.user.userId, id, updateRecommendationDto);
  }
}