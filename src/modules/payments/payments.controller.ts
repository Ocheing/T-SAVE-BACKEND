// src/payment/payment.controller.ts
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
import { PaymentService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ProcessWebhookDto } from './dto/process-webhook.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ===== USER PAYMENTS =====

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiatePayment(
    @Request() req,
    @Body(ValidationPipe) initiatePaymentDto: InitiatePaymentDto,
  ) {
    return this.paymentService.initiatePayment(req.user.userId, initiatePaymentDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserPayments(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.paymentService.getUserPayments(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getUserTransactions(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.paymentService.getUserTransactions(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getPaymentStats(@Request() req) {
    return this.paymentService.getPaymentStats(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getPaymentById(@Request() req, @Param('id') id: string) {
    return this.paymentService.getPaymentById(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/retry')
  async retryPayment(@Request() req, @Param('id') id: string) {
    return this.paymentService.retryPayment(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/cancel')
  async cancelPayment(@Request() req, @Param('id') id: string) {
    return this.paymentService.cancelPayment(req.user.userId, id);
  }

  // ===== WEBHOOKS =====

  @Post('webhook/mpesa')
  async processMpesaWebhook(@Body(ValidationPipe) processWebhookDto: ProcessWebhookDto) {
    return this.paymentService.processMpesaWebhook(processWebhookDto);
  }

  @Post('webhook/card')
  async processCardWebhook(@Body(ValidationPipe) processWebhookDto: ProcessWebhookDto) {
    return this.paymentService.processCardWebhook(processWebhookDto);
  }

  // ===== ADMIN ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  async getAllPayments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.paymentService.getAllPayments(page, limit);
  }
}