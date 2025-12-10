import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PaymentDto } from './dto/payment.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  // ===== BOOKING CRUD OPERATIONS =====

  async createBooking(userId: string, createBookingDto: CreateBookingDto) {
    const { tripId, type, title, description, cost, travelDate, paymentMethod = 'card' } = createBookingDto;

    // Validate required fields
    if (!tripId || !type || !title || !cost) {
      throw new BadRequestException('Trip ID, type, title, and cost are required');
    }

    // Check if trip exists
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId, isActive: true },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Check if user has sufficient savings for this trip if using savings
    if (paymentMethod === 'savings') {
      const userSavings = await this.prisma.saving.aggregate({
        where: {
          userId,
          isCompleted: true,
        },
        _sum: {
          currentAmount: true,
        },
      });

      const totalSavings = userSavings._sum.currentAmount || 0;

      if (totalSavings < cost) {
        throw new BadRequestException('Insufficient savings for this booking');
      }
    }

    return this.prisma.booking.create({
      data: {
        userId,
        tripId,
        type,
        title,
        description,
        cost,
        travelDate,
        paymentMethod,
        isPaid: paymentMethod === 'savings',
        status: paymentMethod === 'savings' ? 'confirmed' : 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        trip: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async getUserBookings(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
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
            },
          },
          transactions: {
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingById(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        trip: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            reference: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return booking;
  }

  async updateBookingStatus(userId: string, bookingId: string, status: string) {
    const validStatuses = ['pending', 'confirmed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid booking status');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status },
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
          },
        },
      },
    });
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    // If booking was paid, create a refund transaction
    if (booking.isPaid) {
      await this.prisma.transaction.create({
        data: {
          userId,
          amount: booking.cost,
          type: 'refund',
          status: 'completed',
          provider: 'system',
          reference: `REFUND-${bookingId}-${Date.now()}`,
          category: 'travel',
          notes: `Refund for cancelled booking: ${booking.title}`,
          bookingId: booking.id,
        },
      });
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: 'cancelled',
        isPaid: false,
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
          },
        },
      },
    });
  }

  // ===== PAYMENT PROCESSING =====

  async processPayment(userId: string, bookingId: string, paymentDto: PaymentDto) {
    const { amount, provider, reference, method = 'card' } = paymentDto;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.isPaid) {
      throw new BadRequestException('Booking is already paid');
    }

    if (amount < booking.cost) {
      throw new BadRequestException('Payment amount is less than booking cost');
    }

    // Create payment transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        amount,
        type: 'booking_payment',
        status: 'completed',
        provider,
        reference,
        category: 'travel',
        notes: `Payment for booking: ${booking.title}`,
        bookingId: booking.id,
      },
    });

    // Update booking as paid
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        isPaid: true,
        status: 'confirmed',
        paymentMethod: method,
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
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            reference: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      booking: updatedBooking,
      transaction,
    };
  }

  // ===== BOOKING STATISTICS =====

  async getBookingStats(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: {
        trip: true,
      },
    });

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

    const totalSpent = bookings
      .filter(b => b.isPaid)
      .reduce((sum, booking) => sum + booking.cost, 0);

    const upcomingTrips = bookings
      .filter(b => b.travelDate && b.travelDate > new Date() && b.status === 'confirmed')
      .sort((a, b) => {
        const dateA = a.travelDate?.getTime() || 0;
        const dateB = b.travelDate?.getTime() || 0;
        return dateA - dateB;
      })
      .slice(0, 5);

    return {
      totalBookings,
      statusBreakdown: {
        confirmed: confirmedBookings,
        pending: pendingBookings,
        cancelled: cancelledBookings,
      },
      financials: {
        totalSpent,
        averageSpent: totalBookings > 0 ? totalSpent / totalBookings : 0,
      },
      upcomingTrips,
    };
  }

  async getBookingsByStatus(userId: string, status: string) {
    const validStatuses = ['pending', 'confirmed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid booking status');
    }

    return this.prisma.booking.findMany({
      where: {
        userId,
        status,
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
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // ===== ADMIN METHODS =====

  async getAllBookings(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          trip: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.booking.count(),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}