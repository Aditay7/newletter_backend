import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../auth/auth.service';
import { UserService } from './users.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) { }

  // Public routes - no auth required
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return { message: 'User registered successfully', userId: user.id };
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    const user = await this.authService.validateUser(loginUserDto.email, loginUserDto.password);
    return await this.authService.login(user);
  }

  // Protected routes - require authentication
  @UseGuards(JwtAuthGuard)
  @Get('profile/:id')
  async getProfile(@Param('id') id: string, @Request() req) {
    return await this.userService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile/:id')
  async update(@Param('id') id: string, @Body() updateUserDto: Partial<CreateUserDto>, @Request() req) {
    return await this.userService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('profile/:id')
  async remove(@Param('id') id: string, @Request() req) {
    return await this.userService.remove(id);
  }
}
