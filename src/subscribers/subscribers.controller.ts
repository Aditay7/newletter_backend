import { Controller, Get, Post, Body, Put, Param, Query, ParseIntPipe, UseGuards, Request, Delete } from '@nestjs/common';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { SubscriberService } from './subscribers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subscribers')
@UseGuards(JwtAuthGuard) // Protect all subscriber routes
export class SubscriberController {
  constructor(private readonly subscriberService: SubscriberService) { }

  @Post()
  create(@Body() createSubscriberDto: CreateSubscriberDto, @Request() req) {
    return this.subscriberService.create(createSubscriberDto);
  }

  @Get()
  findAll(
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
    @Request() req: any
  ) {
    return this.subscriberService.findAll(page, limit, req.user.organizationId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateSubscriberDto: UpdateSubscriberDto, @Request() req) {
    return this.subscriberService.update(id, updateSubscriberDto, req.user.organizationId);
  }

  @Post(':id/gpg-key')
  updateGpgKey(
    @Param('id') id: string,
    @Body() body: { gpgPublicKey: string; encryptEmails?: boolean },
    @Request() req,
  ) {
    return this.subscriberService.update(
      id,
      { 
        gpgPublicKey: body.gpgPublicKey,
        encryptEmails: body.encryptEmails !== undefined ? body.encryptEmails : true,
      },
      req.user.organizationId,
    );
  }

  @Delete(':id/gpg-key')
  removeGpgKey(@Param('id') id: string, @Request() req) {
    return this.subscriberService.update(
      id,
      { gpgPublicKey: null, encryptEmails: false },
      req.user.organizationId,
    );
  }
}

// lick-stats/9b50ca2d-0341-4328-a6a7-3c95cabe7333/8f6bf916-eec4-4c38-bd22-954d32d6249d/68ada27a-554c-49d1-b4c3-541a91da38c9