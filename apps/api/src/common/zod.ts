import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class ZodPipe<S extends z.ZodTypeAny> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      statusCode: 400,
      error: 'validation',
      message: 'Request body is invalid',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
}

const toJsonSchema = zodToJsonSchema as unknown as (schema: z.ZodTypeAny, options: { target: 'openApi3' }) => object;

export const ApiZodBody = (schema: z.ZodTypeAny) => ApiBody({ schema: toJsonSchema(schema, { target: 'openApi3' }) });
