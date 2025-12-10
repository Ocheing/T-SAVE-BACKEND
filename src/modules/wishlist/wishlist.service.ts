import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma.service';
import { AddToWishlistDto } from './dto/add-to-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

 constructor(private prisma: PrismaService) {}

  // ===== WISHLIST CRUD OPERATIONS =====

  async addToWishlist(userId: string, addToWishlistDto: AddToWishlistDto) {
    try {
      const { tripId, priority = 'medium', notes, targetDate } = addToWishlistDto;

      // Check if trip exists
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId, isActive: true },
      });

      if (!trip) {
        throw new NotFoundException('Trip not found');
      }

      // Check if already in wishlist
      const existingWishlist = await this.prisma.wishlist.findUnique({
        where: {
          userId_tripId: {
            userId,
            tripId,
          },
        },
      });

      if (existingWishlist) {
        throw new ConflictException('Trip is already in your wishlist');
      }

      const wishlist = await this.prisma.wishlist.create({
        data: {
          userId,
          tripId,
          priority,
          notes,
          targetDate,
        },
        include: {
          trip: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  wishlists: true,
                  savings: true,
                  bookings: true,
                },
              },
            },
          },
        },
      });

      return {
        success: true,
        data: wishlist,
        message: 'Trip added to wishlist successfully'
      };
    } catch (error) {
      this.logger.error('Failed to add to wishlist', error);
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Could not add to wishlist');
    }
  }

  async getUserWishlist(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [wishlists, total] = await Promise.all([
        this.prisma.wishlist.findMany({
          where: { userId },
          skip,
          take: limit,
          include: {
            trip: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
                _count: {
                  select: {
                    wishlists: true,
                    savings: true,
                    bookings: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.wishlist.count({ where: { userId } }),
      ]);

      return {
        success: true,
        data: {
          wishlists,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch user wishlist', error);
      throw new BadRequestException('Could not fetch wishlist');
    }
  }

  async updateWishlistItem(userId: string, wishlistId: string, updateWishlistDto: UpdateWishlistDto) {
    try {
      const wishlist = await this.prisma.wishlist.findUnique({
        where: { id: wishlistId },
      });

      if (!wishlist) {
        throw new NotFoundException('Wishlist item not found');
      }

      if (wishlist.userId !== userId) {
        throw new NotFoundException('Wishlist item not found');
      }

      const updatedWishlist = await this.prisma.wishlist.update({
        where: { id: wishlistId },
        data: updateWishlistDto,
        include: {
          trip: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  wishlists: true,
                  savings: true,
                  bookings: true,
                },
              },
            },
          },
        },
      });

      return {
        success: true,
        data: updatedWishlist,
        message: 'Wishlist item updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update wishlist item', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Could not update wishlist item');
    }
  }

  async removeFromWishlist(userId: string, wishlistId: string) {
    try {
      const wishlist = await this.prisma.wishlist.findUnique({
        where: { id: wishlistId },
      });

      if (!wishlist) {
        throw new NotFoundException('Wishlist item not found');
      }

      if (wishlist.userId !== userId) {
        throw new NotFoundException('Wishlist item not found');
      }

      await this.prisma.wishlist.delete({
        where: { id: wishlistId },
      });

      return {
        success: true,
        message: 'Item removed from wishlist successfully'
      };
    } catch (error) {
      this.logger.error('Failed to remove from wishlist', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Could not remove from wishlist');
    }
  }

  async removeFromWishlistByTripId(userId: string, tripId: string) {
    try {
      const wishlist = await this.prisma.wishlist.findUnique({
        where: {
          userId_tripId: {
            userId,
            tripId,
          },
        },
      });

      if (!wishlist) {
        throw new NotFoundException('Trip is not in your wishlist');
      }

      await this.prisma.wishlist.delete({
        where: {
          userId_tripId: {
            userId,
            tripId,
          },
        },
      });

      return {
        success: true,
        message: 'Trip removed from wishlist successfully'
      };
    } catch (error) {
      this.logger.error('Failed to remove from wishlist by trip ID', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Could not remove from wishlist');
    }
  }

  // ===== WISHLIST STATISTICS =====

  async getWishlistStats(userId: string) {
    try {
      const wishlists = await this.prisma.wishlist.findMany({
        where: { userId },
        include: {
          trip: true,
        },
      });

      const totalItems = wishlists.length;
      const highPriority = wishlists.filter(item => item.priority === 'high').length;
      const mediumPriority = wishlists.filter(item => item.priority === 'medium').length;
      const lowPriority = wishlists.filter(item => item.priority === 'low').length;

      // Calculate total budget for wishlist
      const totalBudget = wishlists.reduce((sum, item) => {
        const tripBudget = item.trip.budgetRange 
          ? this.parseBudgetRange(item.trip.budgetRange)
          : this.calculateAverageBudget(item.trip);
        return sum + tripBudget;
      }, 0);

      const averageBudget = totalItems > 0 ? totalBudget / totalItems : 0;

      const upcomingTrips = wishlists
        .filter(item => item.targetDate && item.targetDate > new Date())
        .sort((a, b) => {
          const dateA = a.targetDate?.getTime() || 0;
          const dateB = b.targetDate?.getTime() || 0;
          return dateA - dateB;
        })
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          title: item.trip.title,
          targetDate: item.targetDate,
          priority: item.priority,
          budget: item.trip.budgetRange || this.formatBudgetRange(item.trip),
        }));

      return {
        success: true,
        data: {
          totalItems,
          priorityBreakdown: {
            high: highPriority,
            medium: mediumPriority,
            low: lowPriority,
          },
          budgetSummary: {
            total: totalBudget,
            average: averageBudget,
          },
          upcomingTrips,
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch wishlist stats', error);
      throw new BadRequestException('Could not fetch wishlist statistics');
    }
  }

  async isTripInWishlist(userId: string, tripId: string): Promise<boolean> {
    try {
      const wishlist = await this.prisma.wishlist.findUnique({
        where: {
          userId_tripId: {
            userId,
            tripId,
          },
        },
      });

      return !!wishlist;
    } catch (error) {
      this.logger.error('Failed to check if trip is in wishlist', error);
      return false;
    }
  }

  async getWishlistByPriority(userId: string, priority: string) {
    try {
      const validPriorities = ['high', 'medium', 'low'];
      if (!validPriorities.includes(priority)) {
        throw new BadRequestException('Invalid priority level');
      }

      const wishlists = await this.prisma.wishlist.findMany({
        where: {
          userId,
          priority,
        },
        include: {
          trip: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  wishlists: true,
                  savings: true,
                  bookings: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        data: wishlists
      };
    } catch (error) {
      this.logger.error('Failed to fetch wishlist by priority', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Could not fetch wishlist');
    }
  }

  // Helper method to parse budget range string
  private parseBudgetRange(budgetRange: string): number {
    const ranges: { [key: string]: number } = {
      'budget': 500,
      'moderate': 1500,
      'luxury': 5000,
      'premium': 10000,
    };
    
    return ranges[budgetRange] || 1000;
  }

  // Helper method to calculate average budget from min and max
  private calculateAverageBudget(trip: any): number {
    if (trip.minBudget && trip.maxBudget) {
      return (trip.minBudget + trip.maxBudget) / 2;
    }
    if (trip.minBudget) return trip.minBudget;
    if (trip.maxBudget) return trip.maxBudget;
    return 1000; // Default average
  }

  // Helper method to format budget range for display
  private formatBudgetRange(trip: any): string {
    if (trip.minBudget && trip.maxBudget) {
      return `${trip.minBudget}-${trip.maxBudget}`;
    }
    if (trip.minBudget) return `From ${trip.minBudget}`;
    if (trip.maxBudget) return `Up to ${trip.maxBudget}`;
    return 'Budget not specified';
  }
}