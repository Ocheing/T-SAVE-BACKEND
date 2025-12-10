import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ===== CORE USER METHODS =====

  async create(userData: { email: string; password: string; name?: string }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    return this.prisma.user.create({
      data: userData,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(id: string, updateData: { name?: string; avatar?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ===== PASSWORD MANAGEMENT =====

  async setPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.findByEmailOrIdWithPassword(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new ConflictException('User does not have a password set');
    }

    // In a real implementation, you would verify the current password here
    // For now, we'll just update the password
    return this.setPassword(userId, newPassword);
  }

  // ===== GOOGLE OAUTH METHODS =====

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  async createWithGoogle(userData: {
    email: string;
    name: string;
    googleId: string;
    avatar?: string;
  }) {
    // Check if user already exists with this email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      // Check if the existing user already has a Google ID
      if (existingUser.googleId) {
        throw new ConflictException('User with this Google account already exists');
      }
      
      // Update existing user with Google ID (link accounts)
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          googleId: userData.googleId,
          avatar: userData.avatar,
        },
      });
    }

    // Check if Google ID is already used by another user
    const existingGoogleUser = await this.prisma.user.findUnique({
      where: { googleId: userData.googleId },
    });

    if (existingGoogleUser) {
      throw new ConflictException('Google account is already linked to another user');
    }

    // Create new user with Google
    return this.prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        googleId: userData.googleId,
        avatar: userData.avatar,
        password: null, // No password for Google users
      },
    });
  }

  async updateGoogleId(userId: string, googleId: string, avatar?: string) {
    // Check if Google ID is already used by another user
    const existingGoogleUser = await this.prisma.user.findUnique({
      where: { googleId },
    });

    if (existingGoogleUser && existingGoogleUser.id !== userId) {
      throw new ConflictException('Google account is already linked to another user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        ...(avatar && { avatar }),
      },
    });
  }

  async unlinkGoogleAccount(userId: string) {
    const user = await this.findByEmailOrIdWithPassword(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.googleId) {
      throw new ConflictException('Google account is not linked');
    }

    // Check if user has a password set (to prevent lockout)
    if (!user.password) {
      throw new ConflictException('Cannot unlink Google account without setting a password first');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
      },
    });
  }

  // ===== UTILITY METHODS =====

  async findByEmailOrIdWithPassword(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { id: identifier },
          { email: identifier }
        ]
      },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        avatar: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            trips: true,
            savings: true,
            bookings: true,
            transactions: true,
            wishlists: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      stats: user._count,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Using transaction to ensure all user data is deleted
    return this.prisma.$transaction(async (tx) => {
      // Delete related records first (due to foreign key constraints)
      await tx.wishlist.deleteMany({ where: { userId } });
      await tx.booking.deleteMany({ where: { userId } });
      await tx.saving.deleteMany({ where: { userId } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.trip.deleteMany({ where: { userId } });
      
      // Finally delete the user
      return tx.user.delete({
        where: { id: userId },
      });
    });
  }

  // ===== ADMIN METHODS (Optional) =====

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // SIMPLE SEARCH - SQLite compatible (case sensitivity depends on SQLite config)
  async searchUsers(query: string) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query } },
          { name: { contains: query } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
      take: 10,
    });
  }
}