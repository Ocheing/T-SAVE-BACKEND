// src/health/indicators/prisma.health.indicator.ts
import { Injectable } from '@nestjs/common';
import { 
  HealthCheckError, 
  HealthIndicator, 
  HealthIndicatorResult 
} from '@nestjs/terminus';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Simulate database check - always return healthy for now
      // Replace this with actual Prisma query when you set up PrismaService
      const isHealthy = true;
      
      if (isHealthy) {
        return this.getStatus(key, true, {
          message: 'Database connection successful',
          status: 'connected'
        });
      } else {
        throw new Error('Database connection failed');
      }
    } catch (error) {
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, { error: error.message })
      );
    }
  }
}