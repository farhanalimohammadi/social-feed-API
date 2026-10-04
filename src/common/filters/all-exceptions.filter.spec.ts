import { BadRequestException, UnauthorizedException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status, headersSent: false };
  const request = { method: 'GET', originalUrl: '/api/v1/x' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('passes through HttpException with the unified shape', () => {
    const { host, status, json } = makeHost();
    filter.catch(new BadRequestException(['a must be a string']), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['a must be a string'],
        error: 'Bad Request',
        path: '/api/v1/x',
      }),
    );
  });

  it('uses the reason phrase for a bare 401', () => {
    const { host, json } = makeHost();
    filter.catch(new UnauthorizedException(), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }));
  });

  it('hides internals for unknown errors', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('secret db detail'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});