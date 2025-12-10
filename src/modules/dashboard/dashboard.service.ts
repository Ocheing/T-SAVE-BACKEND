import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma.service';
import { QuizPreferencesDto } from './dto/quiz-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    try {
      const [
        user,
        quickStats,
        activeSavings,
        recommendedTrips,
        upcomingBookings,
        recentTransactions,
        calendarEvents
      ] = await Promise.all([
        this.getUserProfile(userId),
        this.getQuickStats(userId),
        this.getActiveSavings(userId),
        this.getRecommendedTrips(userId),
        this.getUpcomingBookings(userId),
        this.getRecentTransactions(userId),
        this.getCalendarEvents(userId)
      ]);

      return {
        success: true,
        data: {
          welcomeMessage: this.generateWelcomeMessage(user),
          user: {
            firstName: user.firstName,
            fullName: user.name,
            avatar: user.avatar,
            preferences: user.preferences
          },
          quickStats,
          activeSavings,
          recommendedTrips,
          upcomingBookings,
          recentTransactions,
          calendarEvents,
          quickActions: this.getQuickActions()
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch dashboard data', error);
      throw new Error('Could not load dashboard data');
    }
  }

  async submitQuiz(userId: string, quizPreferencesDto: QuizPreferencesDto) {
    try {
      // Validate required fields
      if (!quizPreferencesDto.travelStyle || !quizPreferencesDto.budgetRange) {
        throw new Error('Travel style and budget range are required');
      }

      // Convert arrays to JSON strings for Prisma
      const preferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        update: {
          travelStyle: quizPreferencesDto.travelStyle,
          budgetRange: quizPreferencesDto.budgetRange,
          preferredActivities: quizPreferencesDto.activities ? JSON.stringify(quizPreferencesDto.activities) : null,
          groupSize: quizPreferencesDto.groupSize,
          climatePreference: quizPreferencesDto.climate,
          destinations: quizPreferencesDto.destinations ? JSON.stringify(quizPreferencesDto.destinations) : null,
          quizCompleted: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          travelStyle: quizPreferencesDto.travelStyle,
          budgetRange: quizPreferencesDto.budgetRange,
          preferredActivities: quizPreferencesDto.activities ? JSON.stringify(quizPreferencesDto.activities) : null,
          groupSize: quizPreferencesDto.groupSize,
          climatePreference: quizPreferencesDto.climate,
          destinations: quizPreferencesDto.destinations ? JSON.stringify(quizPreferencesDto.destinations) : null,
          quizCompleted: true,
        },
      });

      // Generate recommendations based on quiz
      const recommendations = await this.generateQuizRecommendations(quizPreferencesDto);

      return {
        success: true,
        data: {
          preferences,
          recommendations,
          message: 'Quiz submitted successfully! Personalizing your experience...'
        }
      };
    } catch (error) {
      this.logger.error('Failed to submit quiz', error);
      throw new Error('Could not submit quiz');
    }
  }

  async searchTrips(userId: string, query: string, category?: string, budget?: string) {
    try {
      const where: any = {
        isActive: true,
        OR: [
          { title: { contains: query } },
          { destination: { contains: query } },
          { description: { contains: query } },
          { activities: { contains: query } },
        ]
      };

      if (category) where.category = category;
      if (budget) where.budgetRange = budget;

      const trips = await this.prisma.trip.findMany({
        where,
        include: {
          user: { select: { name: true, avatar: true } },
          _count: { select: { wishlists: true, bookings: true } }
        },
        take: 20,
      });

      return {
        success: true,
        data: {
          trips,
          searchQuery: query,
          resultsCount: trips.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to search trips', error);
      throw new Error('Could not search trips');
    }
  }

  async updatePreferences(userId: string, updatePreferencesDto: UpdatePreferencesDto) {
    try {
      const preferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        update: {
          currency: updatePreferencesDto.currency,
          language: updatePreferencesDto.language,
          notifications: updatePreferencesDto.notifications ? 'enabled' : 'disabled',
          updatedAt: new Date(),
        },
        create: {
          userId,
          currency: updatePreferencesDto.currency,
          language: updatePreferencesDto.language,
          notifications: updatePreferencesDto.notifications ? 'enabled' : 'disabled',
        },
      });

      return {
        success: true,
        data: preferences,
        message: 'Preferences updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update preferences', error);
      throw new Error('Could not update preferences');
    }
  }

  async getQuickStats(userId: string) {
    try {
      const [
        totalSaved,
        monthlyAverage,
        activeTripsCount,
        nextTrip,
        completedSavings
      ] = await Promise.all([
        this.getTotalSaved(userId),
        this.getMonthlyAverage(userId),
        this.getActiveTripsCount(userId),
        this.getNextTrip(userId),
        this.getCompletedSavingsCount(userId)
      ]);

      return {
        totalSaved,
        monthlyAverage,
        activeTrips: activeTripsCount,
        nextTrip: nextTrip ? {
          title: nextTrip.trip?.title,
          destination: nextTrip.trip?.destination,
          travelDate: nextTrip.travelDate
        } : null,
        completedGoals: completedSavings
      };
    } catch (error) {
      this.logger.error('Failed to fetch quick stats', error);
      throw new Error('Could not fetch quick stats');
    }
  }

  // Private helper methods
  private async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true
      }
    });

    if (!user) throw new Error('User not found');

    // Extract first name from full name
    const firstName = user.name?.split(' ')[0] || 'Traveler';

    return {
      ...user,
      firstName
    };
  }

  private generateWelcomeMessage(user: any): string {
    const greetings = ['Welcome', 'Hello', 'Hi', 'Greetings', 'Hey there'];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    const timeBasedGreeting = this.getTimeBasedGreeting();
    
    return `${timeBasedGreeting} ${randomGreeting}, ${user.firstName}! Ready for your next adventure?`;
  }

  private getTimeBasedGreeting(): string {
    const hour = new Date().getHours();
    
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  private async getTotalSaved(userId: string): Promise<number> {
    const result = await this.prisma.saving.aggregate({
      where: { userId },
      _sum: { currentAmount: true }
    });
    
    return result._sum.currentAmount || 0;
  }

  private async getMonthlyAverage(userId: string): Promise<number> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const contributions = await this.prisma.contribution.findMany({
      where: {
        saving: { userId },
        date: { gte: sixMonthsAgo },
        status: 'completed'
      },
      select: { amount: true, date: true }
    });

    if (contributions.length === 0) return 0;

    const total = contributions.reduce((sum, contrib) => sum + contrib.amount, 0);
    return total / 6;
  }

  private async getActiveTripsCount(userId: string): Promise<number> {
    return this.prisma.saving.count({
      where: {
        userId,
        isCompleted: false,
        tripId: { not: null }
      }
    });
  }

  private async getNextTrip(userId: string) {
    return this.prisma.booking.findFirst({
      where: {
        userId,
        travelDate: { gte: new Date() },
        status: 'confirmed'
      },
      include: {
        trip: true
      },
      orderBy: { travelDate: 'asc' }
    });
  }

  private async getCompletedSavingsCount(userId: string): Promise<number> {
    return this.prisma.saving.count({
      where: {
        userId,
        isCompleted: true
      }
    });
  }

  private async getActiveSavings(userId: string) {
    return this.prisma.saving.findMany({
      where: {
        userId,
        isCompleted: false
      },
      include: {
        trip: true
      },
      orderBy: { targetDate: 'asc' },
      take: 5
    });
  }

  private async getRecommendedTrips(userId: string) {
    // Get user preferences for personalized recommendations
    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId }
    });

    const where: any = { isActive: true };

    // If user has preferences, use them for filtering
    if (preferences?.quizCompleted) {
      if (preferences.budgetRange) where.budgetRange = preferences.budgetRange;
      if (preferences.travelStyle) where.category = preferences.travelStyle;
      if (preferences.climatePreference) where.climate = preferences.climatePreference;
      
      // Parse JSON string and check length
      const preferredActivities = preferences.preferredActivities 
        ? JSON.parse(preferences.preferredActivities) 
        : [];
      
      if (preferredActivities.length > 0) {
        where.OR = preferredActivities.map((activity: string) => ({
          activities: { contains: activity }
        }));
      }
    } else {
      // Default to featured trips if no preferences
      where.isFeatured = true;
    }

    return this.prisma.trip.findMany({
      where,
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { wishlists: true, bookings: true } }
      },
      orderBy: { popularity: 'desc' },
      take: 6
    });
  }

  private async getUpcomingBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        travelDate: { gte: new Date() },
        status: 'confirmed'
      },
      include: {
        trip: true
      },
      orderBy: { travelDate: 'asc' },
      take: 5
    });
  }

  private async getRecentTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: {
        saving: { include: { trip: true } },
        booking: { include: { trip: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
  }

  private async getCalendarEvents(userId: string) {
    const [upcomingBookings, savingsDeadlines] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          userId,
          travelDate: { gte: new Date() },
          status: 'confirmed'
        },
        select: {
          id: true,
          title: true,
          travelDate: true,
          type: true,
          trip: { select: { destination: true } }
        }
      }),
      this.prisma.saving.findMany({
        where: {
          userId,
          isCompleted: false,
          targetDate: { gte: new Date() }
        },
        select: {
          id: true,
          title: true,
          targetDate: true,
          targetAmount: true,
          currentAmount: true
        }
      })
    ]);

    const events = [
      ...upcomingBookings.map(booking => ({
        id: booking.id,
        title: `${booking.type}: ${booking.title}`,
        date: booking.travelDate,
        type: 'booking' as const,
        destination: booking.trip?.destination
      })),
      ...savingsDeadlines.map(saving => ({
        id: saving.id,
        title: `Target: ${saving.title}`,
        date: saving.targetDate,
        type: 'saving_goal' as const,
        progress: (saving.currentAmount / saving.targetAmount) * 100
      }))
    ];

    return events.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
  }

  private getQuickActions() {
    return [
      {
        title: 'Add Savings Goal',
        icon: '💰',
        route: '/savings/create',
        description: 'Start saving for your dream trip'
      },
      {
        title: 'Book a Trip',
        icon: '✈️',
        route: '/trips',
        description: 'Explore and book your next adventure'
      },
      {
        title: 'View Transactions',
        icon: '📊',
        route: '/transactions',
        description: 'Check your payment history'
      },
      {
        title: 'Take Travel Quiz',
        icon: '🎯',
        route: '/quiz',
        description: 'Get personalized recommendations'
      }
    ];
  }

  private async generateQuizRecommendations(quizData: QuizPreferencesDto) {
    const where: any = { isActive: true };

    // Build search criteria from quiz answers
    if (quizData.budgetRange) where.budgetRange = quizData.budgetRange;
    if (quizData.travelStyle) where.category = quizData.travelStyle;
    if (quizData.climate) where.climate = quizData.climate;
    if (quizData.activities && quizData.activities.length > 0) {
      where.OR = quizData.activities.map(activity => ({
        activities: { contains: activity }
      }));
    }

    return this.prisma.trip.findMany({
      where,
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { wishlists: true, bookings: true } }
      },
      orderBy: { popularity: 'desc' },
      take: 8
    });
  }
}