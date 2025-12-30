import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private templateRepository: Repository<Template>,
  ) {}

  async create(createTemplateDto: CreateTemplateDto, userId: string): Promise<Template> {
    const template = this.templateRepository.create({
      ...createTemplateDto,
      userId,
    });
    return await this.templateRepository.save(template);
  }

  async findAll(userId: string, organizationId: string): Promise<Template[]> {
    return await this.templateRepository.find({
      where: {
        userId,
        organizationId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string, userId: string, organizationId: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: {
        id,
        userId,
        organizationId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async update(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
    userId: string,
    organizationId: string,
  ): Promise<Template> {
    const template = await this.findOne(id, userId, organizationId);
    Object.assign(template, updateTemplateDto);
    return await this.templateRepository.save(template);
  }

  async remove(id: string, userId: string, organizationId: string): Promise<void> {
    const template = await this.findOne(id, userId, organizationId);
    await this.templateRepository.remove(template);
  }

  async renderTemplate(
    templateId: string,
    variables: Record<string, any>,
    userId: string,
    organizationId: string,
  ): Promise<{ html: string; text: string }> {
    const template = await this.findOne(templateId, userId, organizationId);

    let html = template.htmlContent;
    let text = template.textContent || '';

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, String(value));
      text = text.replace(regex, String(value));
    }

    return { html, text };
  }
}
