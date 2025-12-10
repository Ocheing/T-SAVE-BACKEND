import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SavingsService } from './savings.service';
import { CreateSavingDto } from './dto/create-saving.dto';
import { UpdateSavingDto } from './dto/update-saving.dto';
import { ContributionDto } from './dto/contribution.dto';

@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  // ===== SAVINGS GOALS =====

  @UseGuards(JwtAuthGuard)
  @Post()
  async createSavingGoal(
    @Request() req,
    @Body(ValidationPipe) createSavingDto: CreateSavingDto,
  ) {
    return this.savingsService.createSavingGoal(req.user.userId, createSavingDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserSavings(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.savingsService.getUserSavings(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getSavingsStats(@Request() req) {
    return this.savingsService.getSavingsStats(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('completed')
  async getCompletedSavings(@Request() req) {
    return this.savingsService.getCompletedSavings(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('active')
  async getActiveSavings(@Request() req) {
    return this.savingsService.getActiveSavings(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('trip/:tripId')
  async getSavingsByTrip(@Request() req, @Param('tripId') tripId: string) {
    return this.savingsService.getSavingsByTrip(req.user.userId, tripId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getSavingGoalById(@Request() req, @Param('id') id: string) {
    return this.savingsService.getSavingGoalById(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateSavingGoal(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) updateSavingDto: UpdateSavingDto,
  ) {
    return this.savingsService.updateSavingGoal(req.user.userId, id, updateSavingDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteSavingGoal(@Request() req, @Param('id') id: string) {
    return this.savingsService.deleteSavingGoal(req.user.userId, id);
  }

  // ===== CONTRIBUTIONS =====

  @UseGuards(JwtAuthGuard)
  @Post(':id/contributions')
  async addContribution(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) contributionDto: ContributionDto,
  ) {
    return this.savingsService.addContribution(req.user.userId, id, contributionDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/contributions')
  async getContributions(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.savingsService.getContributions(req.user.userId, id, page, limit);
  }

  // ===== CALCULATION TOOLS =====

  @Get('tools/calculate-plan')
  async calculateSavingsPlan(
    @Query('targetAmount') targetAmount: number,
    @Query('frequency') frequency: string,
    @Query('targetDate') targetDate: string,
  ) {
    const date = new Date(targetDate);
    return this.savingsService.calculateSavingsPlan(targetAmount, frequency, date);
  }
}