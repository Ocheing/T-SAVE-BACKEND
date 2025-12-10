import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma.service';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  // ===== TRIP CRUD OPERATIONS =====

  async createTrip(userId: string, createTripDto: {
    title: string;
    destination: string;
    description?: string;
    category: string;
    subcategory?: string;
    tags?: string;
    climate?: string;
    activities?: string;
    amenities?: string;
    budgetRange: string;
    minBudget: number;
    maxBudget: number;
    currency?: string;
    duration?: number;
    bestSeason?: string;
    groupSize?: string;
    difficulty?: string;
    imageUrl?: string;
    gallery?: string;
  }) {
    return this.prisma.trip.create({
      data: {
        ...createTripDto,
        userId,
        currency: createTripDto.currency || 'KES',
      },
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
    });
  }

  async findAllTrips(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where: { isActive: true },
        skip,
        take: limit,
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
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.trip.count({ where: { isActive: true } }),
    ]);

    return {
      trips,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findTripById(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id, isActive: true },
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
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }

  async updateTrip(userId: string, tripId: string, updateTripDto: any) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException('You can only update your own trips');
    }

    return this.prisma.trip.update({
      where: { id: tripId },
      data: updateTripDto,
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
    });
  }

  async deleteTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException('You can only delete your own trips');
    }

    return this.prisma.trip.update({
      where: { id: tripId },
      data: { isActive: false },
    });
  }

  // ===== ADVANCED SEARCH =====

  async searchTrips(filters: {
    query?: string;
    category?: string;
    budgetRange?: string;
    destination?: string;
    groupSize?: string;
    duration?: number;
    minBudget?: number;
    maxBudget?: number;
    page?: number;
    limit?: number;
  }) {
    const {
      query,
      category,
      budgetRange,
      destination,
      groupSize,
      duration,
      minBudget,
      maxBudget,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    // Text search
    if (query) {
      where.OR = [
        { title: { contains: query } },
        { destination: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
      ];
    }

    // Filter by category
    if (category) where.category = category;

    // Filter by budget range
    if (budgetRange) where.budgetRange = budgetRange;

    // Filter by destination
    if (destination) where.destination = { contains: destination };

    // Filter by group size
    if (groupSize) where.groupSize = groupSize;

    // Filter by duration
    if (duration) where.duration = { lte: duration };

    // Filter by budget range (min/max)
    if (minBudget !== undefined || maxBudget !== undefined) {
      where.OR = [
        { minBudget: { gte: minBudget || 0 } },
        { maxBudget: { lte: maxBudget || Number.MAX_SAFE_INTEGER } },
      ];
    }

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: { popularity: 'desc' },
      }),
      this.prisma.trip.count({ where }),
    ]);

    return {
      trips,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ===== CATEGORIES AND FILTERS =====

  async getCategories() {
    const categories = await this.prisma.trip.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: {
        id: true,
      },
    });

    return categories.map(cat => ({
      name: cat.category,
      count: cat._count.id,
    }));
  }

  async getDestinations() {
    const destinations = await this.prisma.trip.groupBy({
      by: ['destination'],
      where: { isActive: true },
      _count: {
        id: true,
      },
    });

    return destinations.map(dest => ({
      name: dest.destination,
      count: dest._count.id,
    }));
  }

  async getFeaturedTrips() {
    return this.prisma.trip.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      take: 6,
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
      orderBy: {
        popularity: 'desc',
      },
    });
  }

  async getPopularTrips(limit: number = 8) {
    return this.prisma.trip.findMany({
      where: { isActive: true },
      take: limit,
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
      orderBy: {
        popularity: 'desc',
      },
    });
  }

  // ===== TRIP STATISTICS =====

  async getTripStats(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        _count: {
          select: {
            wishlists: true,
            savings: true,
            bookings: true,
          },
        },
        savings: {
          select: {
            currentAmount: true,
            targetAmount: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const totalSaved = trip.savings.reduce((sum, saving) => sum + saving.currentAmount, 0);
    const totalTarget = trip.savings.reduce((sum, saving) => sum + saving.targetAmount, 0);

    return {
      ...trip,
      stats: {
        totalSaved,
        totalTarget,
        savingsProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
        wishlistCount: trip._count.wishlists,
        savingsCount: trip._count.savings,
        bookingCount: trip._count.bookings,
      },
    };
  }

  async incrementPopularity(tripId: string) {
    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        popularity: {
          increment: 1,
        },
      },
    });
  }
}