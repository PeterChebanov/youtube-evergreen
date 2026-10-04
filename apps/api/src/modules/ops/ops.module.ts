import { Module } from '@nestjs/common';
import { StyleModule } from '../style/style.module';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({ imports: [StyleModule], controllers: [OpsController], providers: [OpsService] })
export class OpsModule {}
