export class UpdateRssFeedDto {
  name?: string;
  feedUrl?: string;
  listId?: string;
  isActive?: boolean;
  checkIntervalHours?: number;
  campaignTemplate?: string;
  campaignSubject?: string;
}
