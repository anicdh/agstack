/**
 * BaseCrudController — abstract base for all CRUD controllers.
 *
 * DO NOT use directly. Extend in concrete controller:
 *
 * @example
 * @Controller("users")
 * @ApiTags("Users")
 * export class UsersController extends BaseCrudController<User, CreateUserDto, UpdateUserDto> {
 *   constructor(private readonly usersService: UsersService) {
 *     super(usersService);
 *   }
 *
 *   // Add custom endpoints beyond CRUD:
 *   @Get("me")
 *   @UseGuards(JwtAuthGuard)
 *   getProfile(@Req() req: AuthRequest) {
 *     return this.service.findById(req.user.id);
 *   }
 * }
 *
 * NOTE: This controller has NO decorators (@Controller, @ApiTags).
 * Subclass MUST add decorators + Guards.
 *
 * SWAGGER: Generic types are erased at runtime — NestJS Swagger plugin
 * cannot discover DTO schemas from BaseCrudController. Subclass MUST
 * override create() and update() with explicit DTO class + @ApiBody()
 * so Swagger shows the request body schema. See DummiesController.
 */

import {
  Body,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { BaseResponseDto } from "./dto/base-response.dto";
import { PaginationDto } from "./dto/pagination.dto";
import { BaseCrudService } from "./base-crud.service";

export abstract class BaseCrudController<
  TEntity,
  TCreateDto,
  TUpdateDto,
> {
  constructor(
    protected readonly service: BaseCrudService<TEntity, TCreateDto, TUpdateDto>,
  ) {}

  @Get()
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<BaseResponseDto<TEntity[]>> {
    const { data, meta } = await this.service.findAll(
      pagination.page,
      pagination.limit,
    );
    return BaseResponseDto.paginated(data, {
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
    });
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BaseResponseDto<TEntity>> {
    const entity = await this.service.findById(id);
    return BaseResponseDto.ok(entity);
  }

  @Post()
  async create(
    @Body() dto: TCreateDto,
  ): Promise<BaseResponseDto<TEntity>> {
    const entity = await this.service.create(dto);
    return BaseResponseDto.created(entity);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TUpdateDto,
  ): Promise<BaseResponseDto<TEntity>> {
    const entity = await this.service.update(id, dto);
    return BaseResponseDto.ok(entity);
  }

  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BaseResponseDto<TEntity>> {
    const entity = await this.service.remove(id);
    return BaseResponseDto.ok(entity);
  }
}
