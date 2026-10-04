import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

export function configureApp(app: INestApplication) {
  app.enableCors({ origin: true });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();
  return app;
}

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const doc = new DocumentBuilder().setTitle('YouTube AI Tool API').setDescription('Evergreen video authoring pipeline').setVersion('0.2.0').build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  await app.listen(process.env.PORT ?? 3000);
}

if (require.main === module) void bootstrap();
