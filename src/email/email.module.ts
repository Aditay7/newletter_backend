import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GpgModule } from '../gpg/gpg.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    // Using ConfigService for type-safe access to environment variables
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST', 'smtp.gmail.com'), // Default to Gmail
          port: configService.get<number>('SMTP_PORT', 587),
          secure: false, // true for 465, false for other ports
          auth: {
            user: configService.get<string>('SMTP_USER'),
            pass: configService.get<string>('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: configService.get<string>('SMTP_FROM_EMAIL', 'noreply@newsletter.com'),
        },
      }),
    }),
    GpgModule,
  ],
  providers: [EmailService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}
