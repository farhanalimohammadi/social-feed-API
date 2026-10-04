import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/index.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureApp(app);

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const port = config.get('port', { infer: true });

  const swaggerEnabled =
    config.get('nodeEnv', { infer: true }) !== 'production';
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Social Feed API')
        .setDescription(
          'Social feed REST API built with NestJS, PostgreSQL (Prisma) and Redis',
        )
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/api/v1`);
  if (swaggerEnabled) {
    logger.log(`Swagger UI on http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});