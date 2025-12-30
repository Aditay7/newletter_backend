import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { List } from '../lists/entities/list.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Subscriber } from '../subscribers/entities/subscriber.entity';
import { InjectKnex } from 'nestjs-knex';
import { EmailService } from '../email/email.service';
import { ListService } from '../lists/lists.service';
import { Knex } from 'knex';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(List)
    private listRepository: Repository<List>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Subscriber)
    private subscriberRepository: Repository<Subscriber>,
    private readonly emailService: EmailService,
    private readonly listService: ListService, 
    @InjectKnex() private readonly knex: Knex,
  ) { }

  async createCampaign(createCampaignDto: CreateCampaignDto, organizationId?: string): Promise<Campaign> {
    const campaign = new Campaign();
    campaign.subject = createCampaignDto.subject;
    campaign.content = createCampaignDto.content;

    if (createCampaignDto.listId) {
      const where: any = { id: createCampaignDto.listId };
      if (organizationId) {
        where.organization = { id: organizationId };
      }
      const list = await this.listRepository.findOne({ where, relations: ['organization'] });
      if (!list) {
        throw new NotFoundException('List not found or does not belong to your organization');
      }
      campaign.list = list;
    }

    if (createCampaignDto.organizationId) {
      const organization = await this.organizationRepository.findOne({ where: { id: createCampaignDto.organizationId } });
      if (organization) {
        campaign.organization = organization;
      }
    }

    return this.campaignRepository.save(campaign);
  }

  async listCampaigns(organizationId?: string): Promise<Campaign[]> {
    const where: any = {};
    if (organizationId) {
      where.organization = { id: organizationId };
    }
    return this.campaignRepository.find({
      where,
      relations: ['list', 'organization'],
      order: { createdAt: 'DESC' },
    });
  }

   async sendCampaign(
    id: string,
    filters?: Record<string, any>,
    organizationId?: string,
  ): Promise<any> {
    // find campaign
    const where: any = { id };
    if (organizationId) {
      where.organization = { id: organizationId };
    }
    const campaign = await this.campaignRepository.findOne({
      where,
      relations: ['list', 'organization'],
    });

    if (!campaign) throw new NotFoundException('Campaign not found or does not belong to your organization');

    // Segment subscribers using working segmentation function
    const segmented = await this.listService.segmentSubscribers(
      campaign.list.id,
      filters || {},
    );

    const subscribers = segmented.data;

    if (!subscribers.length) {
      return { message: 'No subscribers matched segmentation filters' };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const sub of subscribers) {
      try {
        // Use GPG encryption if subscriber has a public key and encryption enabled
        const gpgKey = sub.encryptEmails && sub.gpgPublicKey ? sub.gpgPublicKey : undefined;
        
        await this.emailService.sendEmail(
          sub.email,
          campaign.subject,
          campaign.content,
          sub, // Pass subscriber data for merge tags
          gpgKey, // Pass GPG public key if available
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${sub.email}:`, err.message);
        failedCount++;
      }
    }

    return {
      campaignId: campaign.id,
      message: `Campaign "${campaign.subject}" completed.`,
      totalSubscribers: subscribers.length,
      filters: filters || {},
      sent: successCount,
      failed: failedCount,
    };
  }

  async getTrackingSettingsByCidTx(
    tx: Knex.Transaction,
    cid: string,
  ) {
    try {
      const entity = await tx('campaigns')
        .where('campaigns.id', cid)
        .select(['campaigns.id', 'campaigns.click_tracking_disabled', 'campaigns.open_tracking_disabled'])
        .first();
      if (!entity) {
        throw new NotFoundException(`Campaign with CID ${cid} not found`);
      }
      return entity;
    } catch (error) {
      console.error('Error fetching campaign tracking settings:', error);
      throw error;
    }
  }
}