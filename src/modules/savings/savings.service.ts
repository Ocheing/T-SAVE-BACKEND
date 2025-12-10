import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma.service';
import { CreateSavingDto } from './dto/create-saving.dto';
import { UpdateSavingDto } from './dto/update-saving.dto';
import { ContributionDto } from './dto/contribution.dto';

interface ProcessedContribution {
  saving: any;
  contribution: any;
}

@Injectable()
export class SavingsService {
  constructor(private prisma: PrismaService) {}

  // ===== SAVINGS CRUD OPERATIONS =====

  async createSavingGoal(userId: string, createSavingDto: CreateSavingDto) {
    const {
      title,
      targetAmount,
      frequency,
      amountPerFrequency,
      startDate,
      targetDate,
      tripId,
      description,
    } = createSavingDto;

    // If tripId is provided, verify the trip exists
    if (tripId) {
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId, isActive: true },
      });

      if (!trip) {
        throw new NotFoundException('Trip not found');
      }
    }

    // Calculate initial progress
    const progress = 0;

    return this.prisma.saving.create({
      data: {
        userId,
        title,
        targetAmount,
        frequency,
        amountPerFrequency,
        startDate,
        targetDate,
        tripId,
        description,
        progress,
        currentAmount: 0,
        isCompleted: false,
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
        contributions: {
          orderBy: {
            date: 'desc',
          },
          take: 5,
        },
        _count: {
          select: {
            contributions: true,
          },
        },
      },
    });
  }

  async getUserSavings(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [savings, total] = await Promise.all([
      this.prisma.saving.findMany({
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
          contributions: {
            orderBy: {
              date: 'desc',
            },
            take: 3,
          },
          _count: {
            select: {
              contributions: true,
            },
          },
        },
        orderBy: [
          { isCompleted: 'asc' },
          { targetDate: 'asc' },
        ],
      }),
      this.prisma.saving.count({ where: { userId } }),
    ]);

    return {
      savings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSavingGoalById(userId: string, savingId: string) {
    const saving = await this.prisma.saving.findUnique({
      where: { id: savingId },
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
        contributions: {
          orderBy: {
            date: 'desc',
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            createdAt: true,
          },
        },
      },
    });

    if (!saving) {
      throw new NotFoundException('Saving goal not found');
    }

    if (saving.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return saving;
  }

  async updateSavingGoal(userId: string, savingId: string, updateSavingDto: UpdateSavingDto) {
    const saving = await this.prisma.saving.findUnique({
      where: { id: savingId },
    });

    if (!saving) {
      throw new NotFoundException('Saving goal not found');
    }

    if (saving.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (saving.isCompleted) {
      throw new BadRequestException('Cannot update completed saving goal');
    }

    return this.prisma.saving.update({
      where: { id: savingId },
      data: updateSavingDto,
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
        contributions: {
          orderBy: {
            date: 'desc',
          },
          take: 5,
        },
      },
    });
  }

  async deleteSavingGoal(userId: string, savingId: string) {
    const saving = await this.prisma.saving.findUnique({
      where: { id: savingId },
    });

    if (!saving) {
      throw new NotFoundException('Saving goal not found');
    }

    if (saving.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Use transaction to delete related records
    return this.prisma.$transaction(async (tx) => {
      // Delete contributions first
      await tx.contribution.deleteMany({
        where: { savingId },
      });

      // Then delete the saving goal
      return tx.saving.delete({
        where: { id: savingId },
      });
    });
  }

  // ===== CONTRIBUTION MANAGEMENT =====

  async addContribution(userId: string, savingId: string, contributionDto: ContributionDto) {
    const { amount, method = 'manual', transactionId } = contributionDto;

    const saving = await this.prisma.saving.findUnique({
      where: { id: savingId },
    });

    if (!saving) {
      throw new NotFoundException('Saving goal not found');
    }

    if (saving.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (saving.isCompleted) {
      throw new BadRequestException('Cannot add contribution to completed saving goal');
    }

    // Calculate new amounts
    const newCurrentAmount = saving.currentAmount + amount;
    const newProgress = (newCurrentAmount / saving.targetAmount) * 100;
    const isCompleted = newCurrentAmount >= saving.targetAmount;

    // Create contribution
    const contribution = await this.prisma.contribution.create({
      data: {
        savingId,
        amount,
        method,
        transactionId,
        status: 'completed',
        date: new Date(),
      },
    });

    // Update saving goal
    const updatedSaving = await this.prisma.saving.update({
      where: { id: savingId },
      data: {
        currentAmount: newCurrentAmount,
        progress: newProgress,
        isCompleted,
        lastContribution: new Date(),
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
        contributions: {
          orderBy: {
            date: 'desc',
          },
          take: 5,
        },
      },
    });

    return {
      saving: updatedSaving,
      contribution,
    };
  }

  async getContributions(userId: string, savingId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    // Verify saving goal belongs to user
    const saving = await this.prisma.saving.findUnique({
      where: { id: savingId },
    });

    if (!saving) {
      throw new NotFoundException('Saving goal not found');
    }

    if (saving.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const [contributions, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { savingId },
        skip,
        take: limit,
        include: {
          transaction: {
            select: {
              id: true,
              provider: true,
              reference: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      }),
      this.prisma.contribution.count({ where: { savingId } }),
    ]);

    return {
      contributions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ===== SAVINGS STATISTICS & ANALYTICS =====

  async getSavingsStats(userId: string) {
    const savings = await this.prisma.saving.findMany({
      where: { userId },
      include: {
        contributions: true,
        trip: true,
      },
    });

    const totalGoals = savings.length;
    const completedGoals = savings.filter(s => s.isCompleted).length;
    const activeGoals = savings.filter(s => !s.isCompleted).length;

    const totalTarget = savings.reduce((sum, saving) => sum + saving.targetAmount, 0);
    const totalSaved = savings.reduce((sum, saving) => sum + saving.currentAmount, 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const totalContributions = savings.reduce((sum, saving) => 
      sum + saving.contributions.length, 0
    );

    const recentContributions = await this.prisma.contribution.findMany({
      where: {
        saving: {
          userId,
        },
      },
      take: 5,
      orderBy: {
        date: 'desc',
      },
      include: {
        saving: {
          select: {
            title: true,
            trip: {
              select: {
                title: true,
                destination: true,
              },
            },
          },
        },
      },
    });

    // Calculate monthly savings trend
    const monthlyTrend = await this.calculateMonthlyTrend(userId);

    return {
      overview: {
        totalGoals,
        completedGoals,
        activeGoals,
        totalTarget,
        totalSaved,
        overallProgress,
        totalContributions,
      },
      recentContributions,
      monthlyTrend,
    };
  }

  async getSavingsByTrip(userId: string, tripId: string) {
    // Verify trip exists and user has access
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId, isActive: true },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return this.prisma.saving.findMany({
      where: {
        userId,
        tripId,
      },
      include: {
        contributions: {
          orderBy: {
            date: 'desc',
          },
          take: 3,
        },
        _count: {
          select: {
            contributions: true,
          },
        },
      },
      orderBy: [
        { isCompleted: 'asc' },
        { targetDate: 'asc' },
      ],
    });
  }

  async getCompletedSavings(userId: string) {
    return this.prisma.saving.findMany({
      where: {
        userId,
        isCompleted: true,
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
        contributions: {
          orderBy: {
            date: 'desc',
          },
          take: 3,
        },
      },
      orderBy: {
        targetDate: 'desc',
      },
    });
  }

  async getActiveSavings(userId: string) {
    return this.prisma.saving.findMany({
      where: {
        userId,
        isCompleted: false,
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
        contributions: {
          orderBy: {
            date: 'desc',
          },
          take: 3,
        },
      },
      orderBy: {
        targetDate: 'asc',
      },
    });
  }

  // ===== UTILITY METHODS =====

  private async calculateMonthlyTrend(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const contributions = await this.prisma.contribution.findMany({
      where: {
        saving: {
          userId,
        },
        date: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    // Group by month and calculate totals
    const monthlyData = contributions.reduce((acc, contribution) => {
      const monthYear = contribution.date.toISOString().substring(0, 7); // YYYY-MM format
      if (!acc[monthYear]) {
        acc[monthYear] = 0;
      }
      acc[monthYear] += contribution.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async calculateSavingsPlan(targetAmount: number, frequency: string, targetDate: Date) {
    const now = new Date();
    const months = (targetDate.getFullYear() - now.getFullYear()) * 12 + 
                  (targetDate.getMonth() - now.getMonth());
    
    const days = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(days / 7);

    let amountPerPeriod: number;

    switch (frequency) {
      case 'daily':
        amountPerPeriod = targetAmount / days;
        break;
      case 'weekly':
        amountPerPeriod = targetAmount / weeks;
        break;
      case 'monthly':
        amountPerPeriod = targetAmount / months;
        break;
      default:
        amountPerPeriod = targetAmount;
    }

    return {
      frequency,
      amountPerPeriod: Math.ceil(amountPerPeriod * 100) / 100, // Round to 2 decimal places
      totalPeriods: frequency === 'daily' ? days : frequency === 'weekly' ? weeks : months,
      estimatedCompletion: targetDate,
    };
  }

  // ===== AUTOMATED SAVINGS =====

  async processRecurringContributions() {
    const today = new Date();
    const savings = await this.prisma.saving.findMany({
      where: {
        isCompleted: false,
        frequency: { in: ['daily', 'weekly', 'monthly'] },
      },
      include: {
        contributions: {
          where: {
            date: {
              gte: new Date(today.getFullYear(), today.getMonth(), 1), // This month
            },
          },
        },
      },
    });

    const processed: ProcessedContribution[] = [];

    for (const saving of savings) {
      const shouldProcess = this.shouldProcessContribution(saving, today);
      
      if (shouldProcess) {
        try {
          const result = await this.addContribution(
            saving.userId,
            saving.id,
            {
              amount: saving.amountPerFrequency,
              method: 'auto-debit',
            }
          );
          processed.push(result);
        } catch (error) {
          console.error(`Failed to process contribution for saving ${saving.id}:`, error);
        }
      }
    }

    return processed;
  }

  private shouldProcessContribution(saving: any, today: Date): boolean {
    const lastContribution = saving.contributions[0]?.date;
    
    if (!lastContribution) {
      return true; // No contributions yet, process first one
    }

    const lastContributionDate = new Date(lastContribution);
    
    switch (saving.frequency) {
      case 'daily':
        return lastContributionDate.toDateString() !== today.toDateString();
      case 'weekly':
        const daysSinceLast = Math.floor((today.getTime() - lastContributionDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceLast >= 7;
      case 'monthly':
        return lastContributionDate.getMonth() !== today.getMonth() || 
               lastContributionDate.getFullYear() !== today.getFullYear();
      default:
        return false;
    }
  }
}