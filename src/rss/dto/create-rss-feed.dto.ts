export class CreateRssFeedDto {
  name: string;
  feedUrl: string;
  listId: string;
  organizationId: string;
  checkIntervalHours?: number;
  campaignTemplate?: string;
  campaignSubject?: string;
}
