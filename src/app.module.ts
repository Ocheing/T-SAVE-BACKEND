import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';

import { PrismaModule } from './utils/prisma.module';
import { AppController } from './app.controller'; 
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TripsModule } from './modules/trips/trips.module';
import { SavingsModule } from './modules/savings/savings.module';
import { PaymentModule } from './modules/payments/payments.module'; // Fixed: Use PaymentModule instead of PaymentsModule
import { BookingsModule } from './modules/bookings/bookings.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
    }),
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        
        if (!secret) {
          throw new Error('JWT_SECRET is not defined in environment variables');
        }

        return {
          secret: secret,
          signOptions: { 
            expiresIn: '86400s'
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    TripsModule,
    SavingsModule,
    PaymentModule, // Fixed: Use PaymentModule
    BookingsModule,
    WishlistModule,
    AiAssistantModule,
    NotificationsModule,
    HealthModule,
  ],
  controllers: [AppController], 
})
export class AppModule {}