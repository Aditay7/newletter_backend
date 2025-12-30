import { Module } from '@nestjs/common';
import { GpgService } from './gpg.service';

@Module({
  providers: [GpgService],
  exports: [GpgService],
})
export class GpgModule {}
