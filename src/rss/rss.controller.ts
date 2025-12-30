import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RssService } from './rss.service';
import { CreateRssFeedDto } from './dto/create-rss-feed.dto';
import { UpdateRssFeedDto } from './dto/update-rss-feed.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rss-feeds')
@UseGuards(JwtAuthGuard)
export class RssController {
  constructor(private readonly rssService: RssService) {}

  @Post()
  create(@Body() createRssFeedDto: CreateRssFeedDto, @Request() req) {
    createRssFeedDto.organizationId = req.user.organizationId;
    return this.rssService.create(createRssFeedDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.rssService.findAll(req.user.organizationId);
  }

  @Get('test')
  testFeed(@Query('url') url: string) {
    return this.rssService.testFeed(url);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.rssService.findOne(id, req.user.organizationId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateRssFeedDto: UpdateRssFeedDto,
    @Request() req,
  ) {
    return this.rssService.update(id, updateRssFeedDto, req.user.organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.rssService.remove(id, req.user.organizationId);
  }

  @Post(':id/check')
  manualCheck(@Param('id') id: string, @Request() req) {
    return this.rssService.manualCheck(id, req.user.organizationId);
  }
}
