import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard'; 
import { DashboardService } from './dashboard.service';
import { QuizPreferencesDto } from './dto/quiz-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getDashboardData(@Request() req) {
    return this.dashboardService.getDashboardData(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('quiz')
  async submitQuiz(
    @Request() req,
    @Body(ValidationPipe) quizPreferencesDto: QuizPreferencesDto,
  ) {
    return this.dashboardService.submitQuiz(req.user.userId, quizPreferencesDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchTrips(
    @Request() req,
    @Query('query') query: string,
    @Query('category') category?: string,
    @Query('budget') budget?: string,
  ) {
    return this.dashboardService.searchTrips(req.user.userId, query, category, budget);
  }

  @UseGuards(JwtAuthGuard)
  @Post('preferences')
  async updatePreferences(
    @Request() req,
    @Body(ValidationPipe) updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.dashboardService.updatePreferences(req.user.userId, updatePreferencesDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('quick-stats')
  async getQuickStats(@Request() req) {
    return this.dashboardService.getQuickStats(req.user.userId);
  }
}