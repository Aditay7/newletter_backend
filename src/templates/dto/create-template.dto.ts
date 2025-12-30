export class CreateTemplateDto {
  name: string;
  description?: string;
  htmlContent: string;
  textContent?: string;
  variables?: Record<string, any>;
  thumbnail?: string;
  organizationId: string;
}
