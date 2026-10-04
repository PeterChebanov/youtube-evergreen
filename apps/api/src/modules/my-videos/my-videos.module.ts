import { Module } from '@nestjs/common';
import { MyVideosController } from './my-videos.controller';

@Module({ controllers: [MyVideosController] })
export class MyVideosModule {}
