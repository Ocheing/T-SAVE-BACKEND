import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(private authService: AuthService) {}

  @Get()
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('redirect')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    try {
      const result = await this.authService.handleGoogleLogin(req.user);
      
      // Redirect to frontend with token (adjust URL for your frontend)
      return res.redirect(
        `http://localhost:3001/auth/success?token=${result.access_token}&user=${encodeURIComponent(JSON.stringify(result.user))}`
      );
    } catch (error) {
      // Redirect to frontend with error
      return res.redirect(
        `http://localhost:3001/auth/error?message=${encodeURIComponent(error.message)}`
      );
    }
  }
}