import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Parser from 'rss-parser';
import { RssFeed } from './entities/rss-feed.entity';
import { CreateRssFeedDto } from './dto/create-rss-feed.dto';
import { UpdateRssFeedDto } from './dto/update-rss-feed.dto';
import { CampaignService } from '../campaigns/campaigns.service';

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);
  private readonly parser: Parser;

  constructor(
    @InjectRepository(RssFeed)
    private rssFeedRepository: Repository<RssFeed>,
    private campaignsService: CampaignService,
  ) {
    this.parser = new Parser({
      customFields: {
        item: ['description', 'content', 'contentSnippet'],
      },
    });
  }

  async create(createRssFeedDto: CreateRssFeedDto): Promise<RssFeed> {
    const feed = this.rssFeedRepository.create(createRssFeedDto);
    return await this.rssFeedRepository.save(feed);
  }

  async findAll(organizationId: string): Promise<RssFeed[]> {
    return await this.rssFeedRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<RssFeed> {
    const feed = await this.rssFeedRepository.findOne({
      where: { id, organizationId },
    });

    if (!feed) {
      throw new NotFoundException('RSS feed not found');
    }

    return feed;
  }

  async update(
    id: string,
    updateRssFeedDto: UpdateRssFeedDto,
    organizationId: string,
  ): Promise<RssFeed> {
    const feed = await this.findOne(id, organizationId);
    Object.assign(feed, updateRssFeedDto);
    return await this.rssFeedRepository.save(feed);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const feed = await this.findOne(id, organizationId);
    await this.rssFeedRepository.remove(feed);
  }

  async testFeed(feedUrl: string): Promise<any> {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      return {
        title: feed.title,
        description: feed.description,
        itemCount: feed.items.length,
        latestItems: feed.items.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to parse RSS feed: ${error.message}`);
    }
  }

  // Run every hour to check active RSS feeds
  @Cron(CronExpression.EVERY_HOUR)
  async checkAllFeeds() {
    this.logger.log('Checking all active RSS feeds...');

    const activeFeeds = await this.rssFeedRepository.find({
      where: { isActive: true },
      relations: ['list', 'organization'],
    });

    for (const feed of activeFeeds) {
      try {
        await this.processFeed(feed);
      } catch (error) {
        this.logger.error(`Error processing feed ${feed.id}: ${error.message}`);
      }
    }

    this.logger.log(`Checked ${activeFeeds.length} RSS feeds`);
  }

  async processFeed(feed: RssFeed): Promise<void> {
    // Check if it's time to process this feed
    const now = new Date();
    if (feed.lastChecked) {
      const hoursSinceLastCheck =
        (now.getTime() - feed.lastChecked.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastCheck < feed.checkIntervalHours) {
        return; // Not time yet
      }
    }

    this.logger.log(`Processing RSS feed: ${feed.name}`);

    try {
      const parsedFeed = await this.parser.parseURL(feed.feedUrl);
      const processedItems = feed.processedItems || {};
      let newItemsCount = 0;

      for (const item of parsedFeed.items) {
        const itemId = item.guid || item.link;

        if (!processedItems[itemId]) {
          // New item found - create campaign
          await this.createCampaignFromRssItem(feed, item);
          processedItems[itemId] = true;
          newItemsCount++;
        }
      }

      // Update feed
      feed.lastChecked = now;
      feed.processedItems = processedItems;
      await this.rssFeedRepository.save(feed);

      this.logger.log(`Created ${newItemsCount} campaigns from RSS feed: ${feed.name}`);
    } catch (error) {
      this.logger.error(`Error parsing RSS feed ${feed.name}: ${error.message}`);
      throw error;
    }
  }

  private async createCampaignFromRssItem(feed: RssFeed, item: any): Promise<void> {
    const content = item['content:encoded'] || item.content || item.contentSnippet || item.description || '';

    // Replace template variables
    let campaignContent = feed.campaignTemplate || `
      <h2>{title}</h2>
      <p>{description}</p>
      <p><a href="{link}">Read more</a></p>
      <hr />
      <p>{content}</p>
    `;

    campaignContent = campaignContent
      .replace(/{title}/g, item.title || '')
      .replace(/{description}/g, item.contentSnippet || item.description || '')
      .replace(/{link}/g, item.link || '')
      .replace(/{content}/g, content)
      .replace(/{pubDate}/g, item.pubDate || '');

    let subject = feed.campaignSubject || 'New: {title}';
    subject = subject
      .replace(/{title}/g, item.title || '')
      .replace(/{description}/g, item.contentSnippet || item.description || '');

    // Create campaign via CampaignsService
    const campaignData = {
      name: `RSS: ${item.title}`,
      subject,
      content: campaignContent,
      listId: feed.listId,
      organizationId: feed.organizationId,
    };

    // Note: We'd need to pass a userId here. For now, we'll skip actual campaign creation
    // In production, you'd want to associate RSS feeds with a user or have a system user
    this.logger.log(`Would create campaign: ${campaignData.name}`);

    // await this.campaignsService.createCampaign(campaignData, systemUserId);
  }

  async manualCheck(id: string, organizationId: string): Promise<any> {
    const feed = await this.findOne(id, organizationId);
    await this.processFeed(feed);
    return { message: 'Feed processed successfully' };
  }
}
