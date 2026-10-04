import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WriterController } from './writer.controller';
import { WriterService } from './writer.service';

@Module({ imports: [ProjectsModule], controllers: [WriterController], providers: [WriterService] })
export class WriterModule {}
