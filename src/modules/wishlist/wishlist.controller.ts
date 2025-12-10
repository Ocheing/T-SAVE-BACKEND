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
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/add-to-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post()
  async addToWishlist(
    @Request() req,
    @Body(ValidationPipe) addToWishlistDto: AddToWishlistDto,
  ) {
    return this.wishlistService.addToWishlist(req.user.userId, addToWishlistDto);
  }

  @Get()
  async getUserWishlist(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.wishlistService.getUserWishlist(req.user.userId, page, limit);
  }

  @Get('stats')
  async getWishlistStats(@Request() req) {
    return this.wishlistService.getWishlistStats(req.user.userId);
  }

  @Get('priority/:priority')
  async getWishlistByPriority(
    @Request() req,
    @Param('priority') priority: string,
  ) {
    return this.wishlistService.getWishlistByPriority(req.user.userId, priority);
  }

  @Get('check/:tripId')
  async isTripInWishlist(
    @Request() req,
    @Param('tripId') tripId: string,
  ) {
    const isInWishlist = await this.wishlistService.isTripInWishlist(req.user.userId, tripId);
    return { isInWishlist };
  }

  @Put(':id')
  async updateWishlistItem(
    @Request() req,
    @Param('id') id: string,
    @Body(ValidationPipe) updateWishlistDto: UpdateWishlistDto,
  ) {
    return this.wishlistService.updateWishlistItem(req.user.userId, id, updateWishlistDto);
  }

  @Delete(':id')
  async removeFromWishlist(@Request() req, @Param('id') id: string) {
    return this.wishlistService.removeFromWishlist(req.user.userId, id);
  }

  @Delete('trip/:tripId')
  async removeFromWishlistByTripId(@Request() req, @Param('tripId') tripId: string) {
    return this.wishlistService.removeFromWishlistByTripId(req.user.userId, tripId);
  }
}