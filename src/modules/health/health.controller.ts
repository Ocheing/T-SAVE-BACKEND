// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { 
  HealthCheckService, 
  HealthCheck, 
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './indicators/prisma.health.indicator';
import { RedisHealthIndicator } from './indicators/redis.health.indicator';
import { ExternalServicesHealthIndicator } from './indicators/external-services.health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
    private externalServicesHealth: ExternalServicesHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database health check
      () => this.prismaHealth.isHealthy('database'),
      
      // Redis health check
      () => this.redisHealth.isHealthy('redis'),
      
      // External services health check
      () => this.externalServicesHealth.isHealthy('external_services'),
      
      // Memory health check
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      
      // Disk storage check
      () => this.disk.checkStorage('disk_storage', {
        thresholdPercent: 0.9,
        path: process.platform === 'win32' ? 'C:\\' : '/',
      }),
    ]);
  }

  @Get('liveness')
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Get('readiness')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('info')
  getInfo() {
    return {
      app: {
        name: 'TravelSave Backend',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      memory: {
        ...process.memoryUsage(),
        usage: `${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`,
      },
      performance: {
        uptime: `${Math.round(process.uptime())} seconds`,
        cpu: process.cpuUsage(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  @HealthCheck()
  async detailed(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('prisma_database'),
      () => this.redisHealth.isHealthy('redis_cache'),
      () => this.externalServicesHealth.isHealthy('third_party_services'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      () => this.disk.checkStorage('disk_storage', {
        thresholdPercent: 0.9,
        path: process.platform === 'win32' ? 'C:\\' : '/',
      }),
    ]);
  }
}