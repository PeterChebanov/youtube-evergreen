import { Global, Module } from '@nestjs/common';
import { DbToolsService } from './db-tools.service';

@Global()
@Module({ providers: [DbToolsService], exports: [DbToolsService] })
export class DbToolsModule {}
