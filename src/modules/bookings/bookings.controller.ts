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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PaymentDto } from './dto/payment.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ===== USER BOOKINGS =====

  @UseGuards(JwtAuthGuard)
  @Post()
  async createBooking(
    @Request() req,
    @Body(ValidationPipe) createBookingDto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(req.user.userId, createBookingDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserBookings(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.bookingsService.getUserBookings(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getBookingStats(@Request() req) {
    return this.bookingsService.getBookingStats(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:status')
  async getBookingsByStatus(
    @Request() req,
    @Param('status') status: string,
  ) {
    return this.bookingsService.getBookingsByStatus(req.user.userId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getBookingById(@Request() req, @Param('id') id: string) {
    return this.bookingsService.getBookingById(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/status')
  async updateBookingStatus(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) updateStatusDto: UpdateStatusDto,
  ) {
    return this.bookingsService.updateBookingStatus(req.user.userId, id, updateStatusDto.status);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/payment')
  async processPayment(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) paymentDto: PaymentDto,
  ) {
    return this.bookingsService.processPayment(req.user.userId, id, paymentDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/cancel')
  async cancelBooking(@Request() req, @Param('id') id: string) {
    return this.bookingsService.cancelBooking(req.user.userId, id);
  }

  // ===== ADMIN ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  async getAllBookings(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.bookingsService.getAllBookings(page, limit);
  }
}