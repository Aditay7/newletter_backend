import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  create(@Body() createTemplateDto: CreateTemplateDto, @Request() req) {
    return this.templatesService.create(createTemplateDto, req.user.userId);
  }

  @Get()
  findAll(@Request() req) {
    return this.templatesService.findAll(req.user.userId, req.user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.templatesService.findOne(id, req.user.userId, req.user.organizationId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Request() req,
  ) {
    return this.templatesService.update(
      id,
      updateTemplateDto,
      req.user.userId,
      req.user.organizationId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.templatesService.remove(id, req.user.userId, req.user.organizationId);
  }

  @Post(':id/render')
  render(
    @Param('id') id: string,
    @Body() body: { variables: Record<string, any> },
    @Request() req,
  ) {
    return this.templatesService.renderTemplate(
      id,
      body.variables,
      req.user.userId,
      req.user.organizationId,
    );
  }
}
