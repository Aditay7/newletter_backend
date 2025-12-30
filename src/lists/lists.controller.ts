import { Controller, Get, Post, Body, Put, Param, UseInterceptors, UploadedFile,BadRequestException, UseGuards, Request } from '@nestjs/common';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListService } from './lists.service';
import { extname } from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lists')
@UseGuards(JwtAuthGuard) // Protect all list routes
export class ListController {
  constructor(private readonly listService: ListService) { }

  @Post()
  create(@Body() createListDto: CreateListDto, @Request() req) {
    return this.listService.create(createListDto, req.user.userId);
  }
  
  @Post(':listId/import-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/csv', // folder to save uploaded files
        filename: (req, file, cb) => {
          const randomName = Date.now() + extname(file.originalname);
          cb(null, randomName);
        },
      }),
    }),
  )
  async importCsv(@Param('listId') listId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.listService.importCsv(listId, file.path);
  }

  @Get()
  findAll(@Request() req) {
    return this.listService.findAll(req.user.userId, req.user.organizationId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateListDto: UpdateListDto, @Request() req) {
    return this.listService.update(id, updateListDto, req.user.userId, req.user.organizationId);
  }

  @Post(':listId/segment')
  async segmentSubscribers(
    @Param('listId') listId: string,
    @Body() filters: Record<string, any>,
  ) {
    return this.listService.segmentSubscribers(listId, filters);
  }

}