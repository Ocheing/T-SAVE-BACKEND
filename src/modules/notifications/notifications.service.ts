// src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto';

// Define proper interfaces
interface Achievement {
  title: string;
  message: string;
}

interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  savingId?: string;
  bookingId?: string;
  actionUrl?: string;
}

interface EmailData {
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  savingsReminders: boolean;
  upcomingTripAlerts: boolean;
  achievementCelebrations: boolean;
  marketingEmails: boolean;
  pushNotifications: boolean;
}

interface UserWithPreferences {
  id: string;
  email: string;
  name: string | null;
  preferences: {
    notifications: string | null;
  } | null;
}

interface SavingWithContributions {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  contributions?: { id: string }[];
  trip?: {
    destination: string;
  } | null;
}

// Add Prisma Notification type
type PrismaNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string | null;
  userId: string;
  savingId?: string | null;
  bookingId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where: { userId },
          include: {
            saving: { include: { trip: true } },
            booking: { include: { trip: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.notification.count({ where: { userId } })
      ]);

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch user notifications', error);
      throw new Error('Could not fetch notifications');
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await this.prisma.notification.count({
        where: { 
          userId,
          isRead: false
        }
      });

      return {
        success: true,
        data: { unreadCount: count }
      };
    } catch (error) {
      this.logger.error('Failed to fetch unread count', error);
      throw new Error('Could not fetch unread count');
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      const notification = await this.prisma.notification.update({
        where: { 
          id: notificationId,
          userId 
        },
        data: { isRead: true }
      });

      return {
        success: true,
        data: notification,
        message: 'Notification marked as read'
      };
    } catch (error) {
      this.logger.error('Failed to mark notification as read', error);
      throw new Error('Could not mark notification as read');
    }
  }

  async markAllAsRead(userId: string) {
    try {
      await this.prisma.notification.updateMany({
        where: { 
          userId,
          isRead: false
        },
        data: { isRead: true }
      });

      return {
        success: true,
        message: 'All notifications marked as read'
      };
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read', error);
      throw new Error('Could not mark all notifications as read');
    }
  }

  async getNotificationSettings(userId: string): Promise<{ success: boolean; data: NotificationSettings }> {
    try {
      const preferences = await this.prisma.userPreferences.findUnique({
        where: { userId }
      });

      const defaultSettings: NotificationSettings = {
        emailNotifications: true,
        savingsReminders: true,
        upcomingTripAlerts: true,
        achievementCelebrations: true,
        marketingEmails: false,
        pushNotifications: true
      };

      let userNotificationSettings: NotificationSettings = defaultSettings;
      
      if (preferences?.notifications) {
        try {
          const parsedSettings = JSON.parse(preferences.notifications);
          userNotificationSettings = {
            ...defaultSettings,
            ...parsedSettings
          };
        } catch (parseError) {
          this.logger.warn('Failed to parse notification settings, using defaults');
        }
      }

      return {
        success: true,
        data: userNotificationSettings
      };
    } catch (error) {
      this.logger.error('Failed to fetch notification settings', error);
      throw new Error('Could not fetch notification settings');
    }
  }

  async updateNotificationSettings(
    userId: string, 
    updateSettingsDto: UpdateNotificationSettingsDto
  ): Promise<{ success: boolean; data: any; message: string }> {
    try {
      const preferences = await this.prisma.userPreferences.upsert({
        where: { userId },
        update: {
          notifications: JSON.stringify(updateSettingsDto)
        },
        create: {
          userId,
          notifications: JSON.stringify(updateSettingsDto)
        }
      });

      const parsedSettings = preferences.notifications ? 
        JSON.parse(preferences.notifications) : {};

      return {
        success: true,
        data: parsedSettings,
        message: 'Notification settings updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update notification settings', error);
      throw new Error('Could not update notification settings');
    }
  }

  async sendSavingsReminder(userId: string): Promise<{ success: boolean; data: { notificationsSent: number }; message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          savings: {
            where: {
              isCompleted: false,
              lastContribution: {
                lt: this.getFrequencyCutoff()
              }
            },
            include: { trip: true }
          },
          preferences: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // FIX: Explicitly type the notifications array
      const notifications: PrismaNotification[] = [];
      const settings = await this.getUserNotificationSettings(user);

      for (const saving of user.savings) {
        if (settings.savingsReminders !== false) {
          const notification = await this.createNotification({
            userId,
            type: 'savings_reminder',
            title: 'Time to Save! 💰',
            message: `Don't forget to contribute to "${saving.title}". Stay on track for your ${saving.trip?.destination || 'dream trip'}!`,
            savingId: saving.id,
            actionUrl: `/savings/${saving.id}/contribute`
          });

          notifications.push(notification);

          if (settings.emailNotifications !== false && user.email) {
            await this.sendEmailNotification(user, {
              subject: `Savings Reminder: ${saving.title}`,
              template: 'savings-reminder',
              data: {
                userName: user.name || 'Traveler',
                savingTitle: saving.title,
                targetAmount: saving.targetAmount,
                currentAmount: saving.currentAmount,
                progress: saving.progress,
                tripDestination: saving.trip?.destination,
                contributeUrl: `/savings/${saving.id}/contribute`
              }
            });
          }
        }
      }

      return {
        success: true,
        data: { notificationsSent: notifications.length },
        message: `Sent ${notifications.length} savings reminders`
      };
    } catch (error) {
      this.logger.error('Failed to send savings reminder', error);
      throw new Error('Could not send savings reminder');
    }
  }

  async sendUpcomingTripAlert(userId: string, tripId: string): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const [user, booking] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          include: { preferences: true }
        }),
        this.prisma.booking.findFirst({
          where: {
            userId,
            tripId,
            travelDate: { gte: new Date() }
          },
          include: { trip: true }
        })
      ]);

      if (!user || !booking) {
        throw new Error('User or booking not found');
      }

      if (!booking.travelDate) {
        return {
          success: true,
          message: 'No travel date set for this booking'
        };
      }

      const daysUntilTrip = Math.ceil(
        (new Date(booking.travelDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilTrip <= 7 && daysUntilTrip > 0) {
        const settings = await this.getUserNotificationSettings(user);
        
        if (settings.upcomingTripAlerts !== false) {
          const notification = await this.createNotification({
            userId,
            type: 'upcoming_trip',
            title: 'Trip Coming Soon! ✈️',
            message: `Your ${booking.trip.destination} trip is in ${daysUntilTrip} day${daysUntilTrip === 1 ? '' : 's'}. Get ready for your adventure!`,
            bookingId: booking.id,
            actionUrl: `/bookings/${booking.id}`
          });

          if (settings.emailNotifications !== false && user.email) {
            await this.sendEmailNotification(user, {
              subject: `Upcoming Trip: ${booking.trip.destination}`,
              template: 'upcoming-trip',
              data: {
                userName: user.name || 'Traveler',
                destination: booking.trip.destination,
                travelDate: booking.travelDate,
                daysUntilTrip,
                bookingDetailsUrl: `/bookings/${booking.id}`
              }
            });
          }

          return {
            success: true,
            data: notification,
            message: 'Upcoming trip alert sent'
          };
        }
      }

      return {
        success: true,
        message: 'No upcoming trip alert needed'
      };
    } catch (error) {
      this.logger.error('Failed to send upcoming trip alert', error);
      throw new Error('Could not send upcoming trip alert');
    }
  }

  async sendSavingsAchievement(userId: string, savingId: string): Promise<{ success: boolean; data: any; message: string }> {
    try {
      const [user, saving] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          include: { preferences: true }
        }),
        this.prisma.saving.findUnique({
          where: { id: savingId },
          include: { 
            trip: true,
            contributions: {
              select: { id: true }
            }
          }
        })
      ]);

      if (!user || !saving) {
        throw new Error('User or saving not found');
      }

      const achievements: Achievement[] = this.checkSavingsAchievements(saving);
      // FIX: Explicitly type the notifications array
      const notifications: PrismaNotification[] = [];
      const settings = await this.getUserNotificationSettings(user);

      for (const achievement of achievements) {
        if (settings.achievementCelebrations !== false) {
          const notification = await this.createNotification({
            userId,
            type: 'achievement',
            title: achievement.title,
            message: achievement.message,
            savingId: saving.id,
            actionUrl: `/savings/${saving.id}`
          });

          notifications.push(notification);

          if (settings.emailNotifications !== false && user.email) {
            await this.sendEmailNotification(user, {
              subject: `Achievement Unlocked: ${achievement.title}`,
              template: 'achievement',
              data: {
                userName: user.name || 'Traveler',
                achievementTitle: achievement.title,
                achievementMessage: achievement.message,
                savingTitle: saving.title,
                progress: saving.progress,
                savingsUrl: `/savings/${saving.id}`
              }
            });
          }
        }
      }

      return {
        success: true,
        data: { 
          achievements: achievements.map(a => ({ title: a.title, message: a.message })),
          notificationsSent: notifications.length
        },
        message: `Processed ${achievements.length} savings achievements`
      };
    } catch (error) {
      this.logger.error('Failed to send savings achievement', error);
      throw new Error('Could not send savings achievement');
    }
  }

  private async createNotification(notificationData: NotificationData): Promise<PrismaNotification> {
    return this.prisma.notification.create({
      data: notificationData
    });
  }

  private getFrequencyCutoff(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return cutoff;
  }

  private checkSavingsAchievements(saving: SavingWithContributions): Achievement[] {
    const achievements: Achievement[] = [];

    // 25% milestone
    if (saving.progress >= 25 && saving.progress < 50) {
      achievements.push({
        title: 'Quarter Way There! 🎉',
        message: `You've saved 25% of your ${saving.targetAmount} target for ${saving.title}. Great progress!`
      });
    }

    // 50% milestone
    if (saving.progress >= 50 && saving.progress < 75) {
      achievements.push({
        title: 'Halfway There! 🌟',
        message: `Amazing! You're halfway to your ${saving.title} goal. Keep up the great work!`
      });
    }

    // 75% milestone
    if (saving.progress >= 75 && saving.progress < 100) {
      achievements.push({
        title: 'Almost There! 🚀',
        message: `You're 75% of the way to ${saving.title}. Your dream trip is within reach!`
      });
    }

    // 100% completion
    if (saving.progress >= 100) {
      achievements.push({
        title: 'Goal Achieved! 🎊',
        message: `Congratulations! You've successfully saved ${saving.targetAmount} for ${saving.title}. Time to book your trip!`
      });
    }

    // Consistent saver (5+ contributions)
    const contributionCount = saving.contributions?.length || 0;
    if (contributionCount >= 5) {
      achievements.push({
        title: 'Consistent Saver! 💪',
        message: `You've made ${contributionCount} contributions to ${saving.title}. Your dedication is paying off!`
      });
    }

    return achievements;
  }

  private async sendEmailNotification(user: UserWithPreferences, emailData: EmailData): Promise<boolean> {
    try {
      this.logger.log(`[EMAIL] Would send to ${user.email}: ${emailData.subject}`);
      // Implement your email service here
      return true;
    } catch (error) {
      this.logger.error('Failed to send email notification', error);
      return false;
    }
  }

  private async getUserNotificationSettings(user: UserWithPreferences): Promise<NotificationSettings> {
    const defaultSettings: NotificationSettings = {
      emailNotifications: true,
      savingsReminders: true,
      upcomingTripAlerts: true,
      achievementCelebrations: true,
      marketingEmails: false,
      pushNotifications: true
    };

    if (!user.preferences?.notifications) {
      return defaultSettings;
    }

    try {
      const parsed = JSON.parse(user.preferences.notifications);
      return {
        ...defaultSettings,
        ...parsed
      };
    } catch (error) {
      this.logger.warn('Failed to parse user notification settings, using defaults');
      return defaultSettings;
    }
  }

  async checkAndSendSavingsReminders(): Promise<{ success: boolean; data: any }> {
    try {
      const usersWithActiveSavings = await this.prisma.user.findMany({
        where: {
          savings: {
            some: {
              isCompleted: false
            }
          }
        },
        include: {
          savings: {
            where: { isCompleted: false },
            include: { trip: true }
          },
          preferences: true
        }
      });

      let totalRemindersSent = 0;

      for (const user of usersWithActiveSavings) {
        const result = await this.sendSavingsReminder(user.id);
        if (result.success) {
          totalRemindersSent += result.data.notificationsSent;
        }
      }

      this.logger.log(`Sent ${totalRemindersSent} savings reminders to ${usersWithActiveSavings.length} users`);
      
      return {
        success: true,
        data: {
          usersProcessed: usersWithActiveSavings.length,
          remindersSent: totalRemindersSent
        }
      };
    } catch (error) {
      this.logger.error('Failed to send bulk savings reminders', error);
      throw new Error('Could not send bulk savings reminders');
    }
  }

  async checkAndSendUpcomingTripAlerts(): Promise<{ success: boolean; data: any }> {
    try {
      const upcomingBookings = await this.prisma.booking.findMany({
        where: {
          travelDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          },
          status: 'confirmed'
        },
        include: {
          user: {
            include: { preferences: true }
          },
          trip: true
        }
      });

      let totalAlertsSent = 0;

      for (const booking of upcomingBookings) {
        if (booking.travelDate) {
          const result = await this.sendUpcomingTripAlert(booking.userId, booking.tripId);
          if (result.success && result.data) {
            totalAlertsSent++;
          }
        }
      }

      this.logger.log(`Sent ${totalAlertsSent} upcoming trip alerts`);
      
      return {
        success: true,
        data: {
          bookingsProcessed: upcomingBookings.length,
          alertsSent: totalAlertsSent
        }
      };
    } catch (error) {
      this.logger.error('Failed to send bulk upcoming trip alerts', error);
      throw new Error('Could not send bulk upcoming trip alerts');
    }
  }
}