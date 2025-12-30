import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { GpgService } from '../gpg/gpg.service';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly gpgService: GpgService,
  ) {}

  replaceMergeTags(content: string, subscriberData: Record<string, any>): string {
    let processedContent = content;

    // Replace standard fields
    const standardFields = {
      email: subscriberData.email || '',
      id: subscriberData.id || '',
    };

    // Replace {{email}}, {{id}}
    for (const [key, value] of Object.entries(standardFields)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      processedContent = processedContent.replace(regex, String(value));
    }

    // Replace custom fields {{customFields.fieldName}}
    if (subscriberData.customFields && typeof subscriberData.customFields === 'object') {
      for (const [key, value] of Object.entries(subscriberData.customFields)) {
        const regex = new RegExp(`{{\\s*customFields\\.${key}\\s*}}`, 'gi');
        processedContent = processedContent.replace(regex, String(value || ''));
        // Also support {{fieldName}} shorthand
        const shorthandRegex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
        processedContent = processedContent.replace(shorthandRegex, String(value || ''));
      }
    }

    return processedContent;
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    subscriberData?: Record<string, any>,
    gpgPublicKey?: string,
  ) {
    // Apply merge tag replacement if subscriber data provided
    const processedSubject = subscriberData ? this.replaceMergeTags(subject, subscriberData) : subject;
    const processedText = subscriberData ? this.replaceMergeTags(text, subscriberData) : text;

    let emailTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #f9f9f9;
                }
                .header {
                    font-size: 24px;
                    margin-bottom: 20px;
                }
                .content {
                    font-size: 18px;
                    margin-bottom: 20px;
                }
                .footer {
                    font-size: 16px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="http://localhost:8000/api/campaigns" width="1" height="1" style="display:none;" />
                <a href="http://localhost:8000/api/click-stats/track/{{campaignId}}?link=https%3A%2F%2Fyoutube.com" target="_blank">
                    Watch Video
                </a>

                <div class="header">
                    <h2>${processedSubject}</h2><br>
                    New Info From NewsLetter !!!
                </div>
                <div class="content">
                    <strong>${processedText}</strong>
                </div>
                <div class="footer">
                    Thank you,<br>
                    Team NewsLetter
                </div>
            </div>
        </body>
        </html>
        `;

    // Encrypt email if GPG public key provided
    if (gpgPublicKey) {
      try {
        emailTemplate = await this.gpgService.encryptHtmlEmail(emailTemplate, gpgPublicKey);
      } catch (error) {
        console.error('GPG encryption failed:', error.message);
        // Send unencrypted if encryption fails
      }
    }

    await this.mailerService.sendMail({
      to,
      subject: processedSubject,
      html: emailTemplate,
    });
  }
}
