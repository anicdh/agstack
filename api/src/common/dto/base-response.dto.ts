/**
 * BaseResponseDto — envelope for ALL API responses.
 *
 * DO NOT return raw data from controller. ALWAYS wrap in BaseResponseDto.
 *
 * @example
 * // Single item
 * return BaseResponseDto.ok(user);
 *
 * // Paginated list
 * return BaseResponseDto.paginated(users, { total: 100, page: 1, limit: 20 });
 *
 * // Created
 * return BaseResponseDto.created(newUser);
 */

export class PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(partial: { total: number; page: number; limit: number }) {
    this.total = partial.total;
    this.page = partial.page;
    this.limit = partial.limit;
    this.totalPages = Math.ceil(partial.total / partial.limit);
  }
}

export class BaseResponseDto<T> {
  data: T;
  meta?: PageMeta | undefined;
  error?: string | undefined;

  private constructor(data: T, meta?: PageMeta, error?: string) {
    this.data = data;
    this.meta = meta;
    this.error = error;
  }

  static ok<T>(data: T): BaseResponseDto<T> {
    return new BaseResponseDto(data);
  }

  static created<T>(data: T): BaseResponseDto<T> {
    return new BaseResponseDto(data);
  }

  static paginated<T>(
    data: T[],
    pagination: { total: number; page: number; limit: number },
  ): BaseResponseDto<T[]> {
    return new BaseResponseDto(data, new PageMeta(pagination));
  }
}
