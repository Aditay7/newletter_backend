import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RssController } from './rss.controller';
import { RssService } from './rss.service';
import { RssFeed } from './entities/rss-feed.entity';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RssFeed]),
    AuthModule,
    forwardRef(() => CampaignsModule),
  ],
  controllers: [RssController],
  providers: [RssService],
  exports: [RssService],
})
export class RssModule {}
