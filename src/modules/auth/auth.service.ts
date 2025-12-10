import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    // Check if user exists and has a password (not Google OAuth user)
    if (!user || !user.password) {
      return null;
    }
    
    // Verify password
    if (await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    
    return null;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id,
      name: user.name 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  async register(registerData: { email: string; password: string; name?: string }) {
    const hashedPassword = await bcrypt.hash(registerData.password, 10);
    
    const user = await this.usersService.create({
      email: registerData.email,
      password: hashedPassword,
      name: registerData.name,
    });

    const payload = { 
      email: user.email, 
      sub: user.id,
      name: user.name 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  async handleGoogleLogin(googleUser: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
  }) {
    // Check if user exists with this Google ID
    let user = await this.usersService.findByGoogleId(googleUser.googleId);

    if (!user) {
      // Check if user exists with this email (for account merging)
      const existingUser = await this.usersService.findByEmail(googleUser.email);
      
      if (existingUser) {
        // Update existing user with Google ID (link accounts)
        user = await this.usersService.updateGoogleId(
          existingUser.id, 
          googleUser.googleId, 
          googleUser.avatar
        );
      } else {
        // Create new user with Google
        user = await this.usersService.createWithGoogle({
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.googleId,
          avatar: googleUser.avatar,
        });
      }
    }

    const payload = { 
      email: user.email, 
      sub: user.id,
      name: user.name 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  // Optional: Method to link Google account to existing email/password account
  async linkGoogleAccount(userId: string, googleUser: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
  }) {
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if Google account is already linked to another user
    const existingGoogleUser = await this.usersService.findByGoogleId(googleUser.googleId);
    if (existingGoogleUser && existingGoogleUser.id !== userId) {
      throw new ConflictException('Google account is already linked to another user');
    }

    // Update user with Google credentials
    return await this.usersService.updateGoogleId(
      userId,
      googleUser.googleId,
      googleUser.avatar
    );
  }

  // Optional: Method to unlink Google account
  async unlinkGoogleAccount(userId: string) {
    // Get user with password field included
    const user = await this.usersService.findByEmailOrIdWithPassword(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.googleId) {
      throw new ConflictException('Google account is not linked');
    }

    // Check if user has a password set (to prevent lockout)
    if (!user.password) {
      throw new ConflictException('Cannot unlink Google account without setting a password first');
    }

    return await this.usersService.unlinkGoogleAccount(userId);
  }
}