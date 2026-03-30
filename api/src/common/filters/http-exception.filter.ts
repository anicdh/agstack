/**
 * Global HTTP Exception Filter — format ALL error responses.
 *
 * Register globally in main.ts:
 * app.useGlobalFilters(new HttpExceptionFilter());
 *
 * Output format:
 * { statusCode: 400, error: "Bad Request", message: "Validation failed" }
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    let statusCode: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
        error = exception.name;
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body["message"] as string | string[]) ?? exception.message;
        error = (body["error"] as string) ?? exception.name;
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      error = "Internal Server Error";

      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception instanceof Error ? exception.message : "Unknown"}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }
}
