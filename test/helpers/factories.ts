import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { TestApp } from './test-app.js';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  accessToken: string;
}

const uniqueSuffix = (): string => randomUUID().replace(/-/g, '').slice(0, 16);

export async function createUser(
  app: TestApp,
  password = 'SuperSecret1!',
): Promise<TestUser> {
  const suffix = uniqueSuffix();
  const username = `user_${suffix}`;
  const email = `${username}@example.com`;

  const registration = await request(app.app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ username, email, password });

  if (registration.status !== 201) {
    throw new Error(
      `Test-user registration failed (${registration.status}): ${JSON.stringify(registration.body)}`,
    );
  }

  const login = await request(app.app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (login.status !== 200) {
    throw new Error(`Test-user login failed (${login.status}): ${JSON.stringify(login.body)}`);
  }

  return {
    id: registration.body.user.id,
    username: registration.body.user.username,
    email: registration.body.user.email,
    accessToken: login.body.accessToken,
  };
}

export const auth = (user: TestUser): Record<string, string> => ({
  Authorization: `Bearer ${user.accessToken}`,
});