import { Global, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from './organizations/organizations.module';
import { UserModule } from './users/users.module';
import { SubscribersModule } from './subscribers/subscribers.module';
import { ListsModule } from './lists/lists.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClickStatsModule } from './click_stats/click_stats.module';
import { AuthModule } from './auth/auth.module';
import { Campaign } from './campaigns/entities/campaign.entity';
import { List } from './lists/entities/list.entity';
import { ClickStat } from './click_stats/entities/click_stat.entity';
import { Organization } from './organizations/entities/organization.entity';
import { Subscriber } from './subscribers/entities/subscriber.entity';
import { Email } from './email/entities/email.entity';
import { User } from './users/entities/user.entity';
import { Link } from './click_stats/entities/link.entity';
import { EmailModule } from './email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/task.module';
import { KnexModule } from 'nestjs-knex';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TemplatesModule } from './templates/templates.module';
import { RssModule } from './rss/rss.module';
import { GpgModule } from './gpg/gpg.module';
import { Template } from './templates/entities/template.entity';
import { RssFeed } from './rss/entities/rss-feed.entity';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `src/.${process.env.NODE_ENV || 'test'}.env`,
      // Validate required environment variables
      validate: (config) => {
        const requiredVars = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'];
        for (const varName of requiredVars) {
          if (!config[varName]) {
            throw new Error(`Missing required environment variable: ${varName}`);
          }
        }
        return config;
      },
    }),
    // Rate limiting configuration
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 10, // 10 requests per minute
    }]),
    // TypeORM configuration using environment variables
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [Campaign, ClickStat, List, Organization, Subscriber, User, Email, Link, Template, RssFeed],
        synchronize: true, // ⚠️ Set to false in production
      }),
    }),
    // Knex configuration using environment variables
    KnexModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        config: {
          client: 'pg',
          connection: {
            host: configService.get<string>('DATABASE_HOST'),
            port: configService.get<number>('DATABASE_PORT'),
            user: configService.get<string>('DATABASE_USER'),
            password: configService.get<string>('DATABASE_PASSWORD'),
            database: configService.get<string>('DATABASE_NAME'),
          },
          pool: { min: 2, max: 10 },
        },
      }),
    }),
    OrganizationsModule, // org
    UserModule, // cruds for user
    SubscribersModule, // subscribe organisations
    ListsModule,
    CampaignsModule,
    ClickStatsModule,
    AuthModule,
    EmailModule, // for emails sending and receiving
    ScheduleModule.forRoot(),
    TasksModule, // cron jobs (calls for every day)
    TemplatesModule, // Template editor
    RssModule, // RSS campaigns
    GpgModule, // GPG encryption
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
