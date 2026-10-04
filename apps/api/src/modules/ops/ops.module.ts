import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { StyleModule } from '../style/style.module';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({ imports: [StyleModule, SearchModule], controllers: [OpsController], providers: [OpsService] })
export class OpsModule {}
