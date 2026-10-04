import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { genreRequestSchema, genreUpdateRequestSchema } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../../common/zod';
import { GenresService } from './genres.service';

@ApiTags('genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  list() {
    return this.genres.list();
  }

  @Post()
  @ApiZodBody(genreRequestSchema)
  create(@Body(new ZodPipe(genreRequestSchema)) body: z.output<typeof genreRequestSchema>) {
    return this.genres.create(body);
  }

  @Patch(':id')
  @ApiZodBody(genreUpdateRequestSchema)
  update(@Param('id') id: string, @Body(new ZodPipe(genreUpdateRequestSchema)) body: z.output<typeof genreUpdateRequestSchema>) {
    return this.genres.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.genres.remove(id);
  }

  @Post('recompute')
  recompute() {
    return this.genres.recomputeAll();
  }
}
