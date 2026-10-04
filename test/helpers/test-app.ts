import { INestApplication, type INestApplication as App } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';

export type TestApp = { app: App; request: typeof request };

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, request };
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}