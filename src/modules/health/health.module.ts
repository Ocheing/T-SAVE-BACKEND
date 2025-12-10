// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { ExternalServicesHealthIndicator } from './indicators/external-services.health.indicator';
import { PrismaService } from '../../utils/prisma.service';

@Module({
  imports: [
    TerminusModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    ExternalServicesHealthIndicator,
    PrismaService, // Provide PrismaService directly
  ],
  exports: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    ExternalServicesHealthIndicator,
  ],
})
export class HealthModule {}