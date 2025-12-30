import { Controller, Post, Body, Get, Param, UseGuards, Request } from '@nestjs/common';
import { CampaignService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('campaigns')
@UseGuards(JwtAuthGuard) // Protect all campaign routes
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Post()
  async createCampaign(@Body() createCampaignDto: CreateCampaignDto, @Request() req) {
    return this.campaignService.createCampaign(createCampaignDto, req.user.organizationId);
  }

  @Get()
  async listCampaigns(@Request() req) {
    return this.campaignService.listCampaigns(req.user.organizationId);
  }

  @Post(':id/send')
  async sendCampaign(
    @Param('id') id: string,
    @Request() req: any,
    @Body() filters?: { country?: string; tag?: string },
  ) {
    return this.campaignService.sendCampaign(id, filters, req.user.organizationId);
  }
}