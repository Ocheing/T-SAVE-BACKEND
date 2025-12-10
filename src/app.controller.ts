import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'Welcome to TSave Backend API',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: {
          register: 'POST /auth/register',
          login: 'POST /auth/login'
        },
        users: {
          profile: 'GET /users/profile',
          updateProfile: 'PUT /users/profile'
        }
      },
      documentation: 'Visit /api/docs for API documentation'
    };
  }
}