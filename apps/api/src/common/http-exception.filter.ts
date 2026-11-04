import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';

/** The one error shape every API response uses. `issues` is only present for validation errors. */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
}

/** The parts of the HTTP request and response the filter reads and writes. */
interface HttpRequest {
  method: string;
  url: string;
}
interface HttpResponse {
  status(code: number): { json(body: ErrorBody): void };
}

function bodyFor(exception: HttpException): ErrorBody {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const details = typeof response === 'string' ? { message: response } : (response as Partial<ErrorBody>);

  const body: ErrorBody = {
    statusCode,
    error: typeof details.error === 'string' ? details.error : (STATUS_CODES[statusCode] ?? 'Error'),
    message: typeof details.message === 'string' ? details.message : exception.message,
  };
  if (Array.isArray(details.issues)) body.issues = details.issues;
  return body;
}

/**
 * Registered globally (see AppModule). Expected errors (HttpException) keep their status and
 * message in one shape. Anything else becomes a generic 500, so stack traces, database details
 * and personal data never reach the client (NFR 2). The log line names only the route and the
 * error type: error messages can contain request data, so they are never logged.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<HttpResponse>();

    if (exception instanceof HttpException) {
      const body = bodyFor(exception);
      response.status(body.statusCode).json(body);
      return;
    }

    const request = http.getRequest<HttpRequest>();
    const path = request.url.split('?')[0];
    const type = exception instanceof Error ? exception.constructor.name : typeof exception;
    this.logger.error(`${request.method} ${path} failed: ${type}`);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  }
}
