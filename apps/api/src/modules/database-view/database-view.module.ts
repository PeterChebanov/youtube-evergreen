import { Module } from '@nestjs/common';
import { DatabaseViewController } from './database-view.controller';
import { DatabaseViewService } from './database-view.service';

@Module({ controllers: [DatabaseViewController], providers: [DatabaseViewService] })
export class DatabaseViewModule {}
