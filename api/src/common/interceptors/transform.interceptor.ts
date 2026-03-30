/**
 * Transform Interceptor — auto-wrap controller return values in BaseResponseDto.
 *
 * Register globally in main.ts:
 * app.useGlobalInterceptors(new TransformInterceptor());
 *
 * If controller returns raw data, the interceptor will wrap it as { data: ... }
 * If controller returns BaseResponseDto, it will pass through.
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import { BaseResponseDto } from "../dto/base-response.dto";

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, BaseResponseDto<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<BaseResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // Already wrapped
        if (data instanceof BaseResponseDto) {
          return data as unknown as BaseResponseDto<T>;
        }
        // Auto-wrap raw data
        return BaseResponseDto.ok(data);
      }),
    );
  }
}
