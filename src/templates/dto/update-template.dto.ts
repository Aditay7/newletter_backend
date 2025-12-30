export class UpdateTemplateDto {
  name?: string;
  description?: string;
  htmlContent?: string;
  textContent?: string;
  variables?: Record<string, any>;
  isActive?: boolean;
  thumbnail?: string;
}
