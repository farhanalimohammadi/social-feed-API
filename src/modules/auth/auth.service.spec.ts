import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

function setup(user: Record<string, unknown> | null) {
  const prisma = { user: { findUnique: vi.fn().mockResolvedValue(user), create: vi.fn() } };
  const hasher = {
    hash: vi.fn(),
    compare: vi.fn().mockResolvedValue(true),
    getDummyHash: vi.fn().mockResolvedValue('dummy-hash'),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed.token') };
  const config = { get: vi.fn().mockReturnValue({ expiresInSeconds: 3600 }) };
  const service = new AuthService(prisma as never, hasher as never, jwt as never, config as never);
  return { service, hasher, jwt };
}

describe('AuthService.login', () => {
  it('still runs bcrypt compare when the email is unknown', async () => {
    const { service, hasher } = setup(null);
    await expect(service.login({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(hasher.compare).toHaveBeenCalledWith('x', 'dummy-hash');
  });

  it('rejects a wrong password with the same error', async () => {
    const { service, hasher } = setup({ id: 'u1', passwordHash: 'h' });
    hasher.compare.mockResolvedValue(false);
    await expect(service.login({ email: 'a@b.com', password: 'x' })).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('returns a token and never exposes passwordHash', async () => {
    const { service, jwt } = setup({ id: 'u1', username: 'ali', passwordHash: 'h' });
    const result = await service.login({ email: 'a@b.com', password: 'x' });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokenType).toBe('Bearer');
  });
});