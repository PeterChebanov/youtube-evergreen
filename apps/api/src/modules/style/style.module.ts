import { Module } from '@nestjs/common';
import { StyleController } from './style.controller';
import { StyleService } from './style.service';

@Module({ controllers: [StyleController], providers: [StyleService], exports: [StyleService] })
export class StyleModule {}
