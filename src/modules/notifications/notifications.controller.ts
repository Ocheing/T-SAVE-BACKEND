// src/notifications/notifications.controller.ts
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
import { NotificationsService } from './notifications.service';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserNotifications(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.notificationsService.getUserNotifications(req.user.userId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('read-all')
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getNotificationSettings(@Request() req) {
    return this.notificationsService.getNotificationSettings(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateNotificationSettings(
    @Request() req,
    @Body(ValidationPipe) updateSettingsDto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateNotificationSettings(
      req.user.userId,
      updateSettingsDto
    );
  }

  @Post('trigger/savings-reminder')
  async triggerSavingsReminder(@Body() body: { userId: string }) {
    return this.notificationsService.sendSavingsReminder(body.userId);
  }

  @Post('trigger/upcoming-trip')
  async triggerUpcomingTripAlert(@Body() body: { userId: string; tripId: string }) {
    return this.notificationsService.sendUpcomingTripAlert(body.userId, body.tripId);
  }

  @Post('trigger/savings-achievement')
  async triggerSavingsAchievement(@Body() body: { userId: string; savingId: string }) {
    return this.notificationsService.sendSavingsAchievement(body.userId, body.savingId);
  }
}