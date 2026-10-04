import { Global, Module } from '@nestjs/common';
import { EmbeddingRepository } from './embedding.repository';
import { PrismaService } from './prisma.service';
import { StatsRepository } from './stats.repository';

@Global()
@Module({
  providers: [PrismaService, EmbeddingRepository, StatsRepository],
  exports: [PrismaService, EmbeddingRepository, StatsRepository],
})
export class PrismaModule {}
