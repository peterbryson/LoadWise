import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  INestApplication,
  Logger,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';
import { HttpExceptionFilter } from './http-exception.filter';
import { ZodValidationPipe } from './zod-validation.pipe';

const SECRET_DETAIL = 'athlete@example.com reported knee pain';

@Controller('errors')
class ErrorsController {
  @Post('validation')
  validation(@Body(new ZodValidationPipe(z.object({ name: z.string().min(2) }))) body: unknown) {
    return body;
  }

  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedException('Invalid or expired sign-in token');
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('No squad matches that invite code');
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException('You are already in this squad');
  }

  @Get('string-response')
  stringResponse(): never {
    throw new HttpException('Too many requests', 429);
  }

  @Get('object-response')
  objectResponse(): never {
    throw new HttpException({ reason: 'internal detail' }, 418);
  }

  @Get('crash')
  crash(): never {
    throw new Error(SECRET_DETAIL);
  }

  @Get('throw-value')
  throwValue(): never {
    throw SECRET_DETAIL;
  }
}

describe('NFR2: consistent error responses (#27)', () => {
  let app: INestApplication;
  const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorsController],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    logged.mockRestore();
  });

  beforeEach(() => logged.mockClear());

  it('keeps the list of failed fields for validation errors (400)', async () => {
    const res = await request(app.getHttpServer()).post('/errors/validation').send({ name: 'x' }).expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      issues: [{ path: 'name', message: expect.any(String) }],
    });
  });

  it.each([
    ['unauthorized', 401, 'Unauthorized', 'Invalid or expired sign-in token'],
    ['not-found', 404, 'Not Found', 'No squad matches that invite code'],
    ['conflict', 409, 'Conflict', 'You are already in this squad'],
  ])('gives %s errors the same shape (%i)', async (route, status, error, message) => {
    const res = await request(app.getHttpServer()).get(`/errors/${route}`).expect(status);

    expect(res.body).toEqual({ statusCode: status, error, message });
  });

  it('fills in the error name when an exception has only a message', async () => {
    const res = await request(app.getHttpServer()).get('/errors/string-response').expect(429);

    expect(res.body).toEqual({ statusCode: 429, error: 'Too Many Requests', message: 'Too many requests' });
  });

  it('keeps only the standard fields when an exception carries a custom object', async () => {
    const res = await request(app.getHttpServer()).get('/errors/object-response').expect(418);

    expect(res.body).toEqual({ statusCode: 418, error: "I'm a Teapot", message: expect.any(String) });
    expect(res.body).not.toHaveProperty('reason');
  });

  it('treats a thrown non-Error value as an unexpected error (500)', async () => {
    const res = await request(app.getHttpServer()).get('/errors/throw-value').expect(500);

    expect(res.body.message).toBe('Something went wrong');
    expect(String(logged.mock.calls[0][0])).toBe('GET /errors/throw-value failed: string');
  });

  it('uses the same shape for routes that do not exist', async () => {
    const res = await request(app.getHttpServer()).get('/errors/missing').expect(404);

    expect(res.body).toEqual({ statusCode: 404, error: 'Not Found', message: expect.any(String) });
  });

  it('hides the details of unexpected errors from the client (500)', async () => {
    const res = await request(app.getHttpServer()).get('/errors/crash').expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
    expect(JSON.stringify(res.body)).not.toContain('knee');
  });

  it('logs unexpected errors by route and type only, never their message', async () => {
    await request(app.getHttpServer()).get('/errors/crash?email=athlete@example.com').expect(500);

    expect(logged).toHaveBeenCalledTimes(1);
    const line = String(logged.mock.calls[0][0]);
    expect(line).toBe('GET /errors/crash failed: Error');
    expect(line).not.toContain('athlete@example.com');
  });

  it('does not log expected client errors', async () => {
    await request(app.getHttpServer()).get('/errors/not-found').expect(404);

    expect(logged).not.toHaveBeenCalled();
  });
});
