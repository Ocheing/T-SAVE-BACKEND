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
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  // ===== PUBLIC ENDPOINTS =====

  @Get()
  async findAllTrips(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.tripsService.findAllTrips(page, limit);
  }

  @Get('search')
  async searchTrips(
    @Query('query') query?: string,
    @Query('category') category?: string,
    @Query('budgetRange') budgetRange?: string,
    @Query('destination') destination?: string,
    @Query('groupSize') groupSize?: string,
    @Query('duration') duration?: number,
    @Query('minBudget') minBudget?: number,
    @Query('maxBudget') maxBudget?: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.tripsService.searchTrips({
      query,
      category,
      budgetRange,
      destination,
      groupSize,
      duration,
      minBudget,
      maxBudget,
      page,
      limit,
    });
  }

  @Get('categories')
  async getCategories() {
    return this.tripsService.getCategories();
  }

  @Get('destinations')
  async getDestinations() {
    return this.tripsService.getDestinations();
  }

  @Get('featured')
  async getFeaturedTrips() {
    return this.tripsService.getFeaturedTrips();
  }

  @Get('popular')
  async getPopularTrips(@Query('limit') limit: number = 8) {
    return this.tripsService.getPopularTrips(limit);
  }

  @Get(':id')
  async findTripById(@Param('id') id: string) {
    // Increment popularity when viewing a trip
    await this.tripsService.incrementPopularity(id);
    return this.tripsService.findTripById(id);
  }

  @Get(':id/stats')
  async getTripStats(@Param('id') id: string) {
    return this.tripsService.getTripStats(id);
  }

  // ===== PROTECTED ENDPOINTS (Admin/Creator) =====

  @UseGuards(JwtAuthGuard)
  @Post()
  async createTrip(
    @Request() req, 
    @Body(ValidationPipe) createTripDto: CreateTripDto
  ) {
    return this.tripsService.createTrip(req.user.userId, createTripDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateTrip(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) updateTripDto: UpdateTripDto,
  ) {
    return this.tripsService.updateTrip(req.user.userId, id, updateTripDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteTrip(@Request() req, @Param('id') id: string) {
    return this.tripsService.deleteTrip(req.user.userId, id);
  }
}