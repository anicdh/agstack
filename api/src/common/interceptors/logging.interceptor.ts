/**
 * Logging Interceptor — log request/response for all endpoints.
 *
 * Register globally in main.ts:
 * app.useGlobalInterceptors(new LoggingInterceptor());
 *
 * Logs: method, url, statusCode, duration, userId (if available)
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: { id: string } | undefined;
    }>();
    const { method, url } = request;
    const userId = request.user?.id ?? "anonymous";
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<{ statusCode: number }>();
        const duration = Date.now() - startTime;

        this.logger.log(
          `${method} ${url} ${response.statusCode} ${duration}ms [user:${userId}]`,
        );
      }),
    );
  }
}
