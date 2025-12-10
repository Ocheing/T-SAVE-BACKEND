// src/health/indicators/external-services.health.indicator.ts
import { Injectable, Logger } from '@nestjs/common';
import { 
  HealthCheckError, 
  HealthIndicator, 
  HealthIndicatorResult 
} from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ServiceHealth {
  name: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  statusCode?: number;
}

@Injectable()
export class ExternalServicesHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(ExternalServicesHealthIndicator.name);

  constructor(private readonly httpService: HttpService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const servicesHealth = await this.checkAllExternalServices();
      
      const allHealthy = servicesHealth.every(service => service.healthy);
      const unhealthyServices = servicesHealth.filter(service => !service.healthy);
      
      const result = this.getStatus(key, allHealthy, {
        services: servicesHealth,
        unhealthy_count: unhealthyServices.length,
        timestamp: new Date().toISOString()
      });

      if (allHealthy) {
        return result;
      }
      
      throw new HealthCheckError(
        `${unhealthyServices.length} external service(s) are unhealthy`, 
        result
      );
    } catch (error) {
      const errorResult = this.getStatus(key, false, {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw new HealthCheckError('External services health check failed', errorResult);
    }
  }

  private async checkAllExternalServices(): Promise<ServiceHealth[]> {
    const services = [
      {
        name: 'mpesa',
        url: process.env.MPESA_HEALTH_CHECK_URL || 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        method: 'GET'
      },
      {
        name: 'email_service',
        url: process.env.EMAIL_SERVICE_URL || 'https://api.sendgrid.com/v3/user/account',
        method: 'GET'
      },
      {
        name: 'payment_gateway',
        url: process.env.PAYMENT_GATEWAY_URL || 'https://api.flutterwave.com/v3/transactions',
        method: 'GET'
      },
      {
        name: 'google_maps',
        url: 'https://maps.googleapis.com/maps/api/geocode/json?address=Kenya',
        method: 'GET'
      },
      {
        name: 'weather_service',
        url: 'https://api.openweathermap.org/data/2.5/weather?q=Nairobi',
        method: 'GET'
      }
    ];

    const healthChecks = services.map(service => 
      this.checkServiceHealth(service)
    );

    return Promise.all(healthChecks);
  }

  private async checkServiceHealth(service: {
    name: string;
    url: string;
    method: string;
  }): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // For demo purposes, we'll simulate some services as external
      // In production, you would make actual HTTP requests
      
      let isHealthy: boolean;
      let statusCode: number;
      let error: string | undefined;

      switch (service.name) {
        case 'mpesa':
          // Simulate M-Pesa health check
          isHealthy = await this.checkMpesaService();
          statusCode = isHealthy ? 200 : 503;
          break;

        case 'email_service':
          // Simulate email service health check
          isHealthy = await this.checkEmailService();
          statusCode = isHealthy ? 200 : 503;
          break;

        case 'payment_gateway':
          // Simulate payment gateway health check
          isHealthy = await this.checkPaymentGateway();
          statusCode = isHealthy ? 200 : 503;
          break;

        case 'google_maps':
          // This would be an actual API call in production
          // For now, simulate
          isHealthy = Math.random() > 0.1; // 90% success
          statusCode = isHealthy ? 200 : 403; // 403 for API key issues
          break;

        case 'weather_service':
          // Simulate weather service
          isHealthy = Math.random() > 0.15; // 85% success
          statusCode = isHealthy ? 200 : 401; // 401 for invalid API key
          break;

        default:
          isHealthy = false;
          statusCode = 500;
          error = 'Unknown service';
      }

      const responseTime = Date.now() - startTime;

      if (!isHealthy && !error) {
        error = this.generateServiceError(service.name);
      }

      return {
        name: service.name,
        healthy: isHealthy,
        responseTime,
        error,
        statusCode
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: service.name,
        healthy: false,
        responseTime,
        error: error.message,
        statusCode: 500
      };
    }
  }

  private async checkMpesaService(): Promise<boolean> {
    try {
      // In production, this would make an actual API call to M-Pesa
      // For demo, simulate with 95% success rate
      
      // Simulate occasional M-Pesa downtime
      const isHealthy = Math.random() > 0.05;
      
      if (!isHealthy) {
        this.logger.warn('M-Pesa service is currently unavailable');
      }
      
      return isHealthy;
    } catch (error) {
      this.logger.error('M-Pesa health check failed', error);
      return false;
    }
  }

  private async checkEmailService(): Promise<boolean> {
    try {
      // Simulate email service (SendGrid, Mailgun, etc.)
      // 98% success rate for demo
      const isHealthy = Math.random() > 0.02;
      
      if (!isHealthy) {
        this.logger.warn('Email service is currently unavailable');
      }
      
      return isHealthy;
    } catch (error) {
      this.logger.error('Email service health check failed', error);
      return false;
    }
  }

  private async checkPaymentGateway(): Promise<boolean> {
    try {
      // Simulate payment gateway (Flutterwave, Stripe, etc.)
      // 97% success rate for demo
      const isHealthy = Math.random() > 0.03;
      
      if (!isHealthy) {
        this.logger.warn('Payment gateway is currently unavailable');
      }
      
      return isHealthy;
    } catch (error) {
      this.logger.error('Payment gateway health check failed', error);
      return false;
    }
  }

  private generateServiceError(serviceName: string): string {
    const errors: Record<string, string[]> = {
      mpesa: [
        'MPesa API timeout',
        'Invalid consumer key',
        'Service temporarily unavailable',
        'Authentication failed'
      ],
      email_service: [
        'Email service quota exceeded',
        'Invalid API key',
        'Service temporarily down',
        'Connection timeout'
      ],
      payment_gateway: [
        'Payment gateway maintenance',
        'Invalid merchant credentials',
        'Service overloaded',
        'SSL certificate error'
      ],
      google_maps: [
        'API key expired',
        'Quota exceeded',
        'Service unavailable',
        'Geocoding service down'
      ],
      weather_service: [
        'Invalid API key',
        'Service rate limit exceeded',
        'Weather data unavailable',
        'Connection refused'
      ]
    };

    const serviceErrors = errors[serviceName] || ['Unknown service error'];
    return serviceErrors[Math.floor(Math.random() * serviceErrors.length)];
  }

  async checkServiceResponseTime(key: string): Promise<HealthIndicatorResult> {
    try {
      const services = await this.checkAllExternalServices();
      const avgResponseTime = services.reduce((sum, service) => 
        sum + (service.responseTime || 0), 0
      ) / services.length;

      const threshold = 1000; // 1 second threshold
      const isHealthy = avgResponseTime <= threshold;

      const result = this.getStatus(key, isHealthy, {
        average_response_time_ms: Math.round(avgResponseTime),
        threshold_ms: threshold,
        services: services.map(s => ({
          name: s.name,
          response_time: s.responseTime,
          healthy: s.healthy
        }))
      });

      if (isHealthy) {
        return result;
      }
      
      throw new HealthCheckError('External services response time exceeded threshold', result);
    } catch (error) {
      const errorResult = this.getStatus(key, false, {
        error: error.message
      });
      throw new HealthCheckError('External services response time check failed', errorResult);
    }
  }
}