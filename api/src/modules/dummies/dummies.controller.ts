/**
 * DummiesController — extends BaseCrudController with custom endpoints.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new controllers.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN:
 * - Standard CRUD endpoints (GET /, GET /:id, POST, PATCH, DELETE) from base class.
 * - Custom endpoints added below the base methods.
 * - Auth guards on all endpoints (add when auth module is ready).
 */

import {
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BaseCrudController } from "@/common/base-crud.controller";
import { DummiesService } from "./dummies.service";
import type { CreateDummyDto } from "./dto/create-dummy.dto";
import type { UpdateDummyDto } from "./dto/update-dummy.dto";
import { BaseResponseDto } from "@/common/dto/base-response.dto";

// Type representing public dummy data
interface DummyPublic {
  id: string;
  name: string;
  email: string;
  status: string;
  category: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Controller("dummies")
@ApiTags("Dummies")
// @UseGuards(JwtAuthGuard)  // Uncomment when auth module is ready
// @ApiBearerAuth()
export class DummiesController extends BaseCrudController<DummyPublic, CreateDummyDto, UpdateDummyDto> {
  constructor(private readonly dummiesService: DummiesService) {
    super(dummiesService);
  }

  // ─── Custom endpoints (beyond standard CRUD) ──────────────

  /**
   * DEMONSTRATES: Adding custom filtered endpoint alongside base CRUD.
   * Base class already provides GET / (all with pagination).
   * This endpoint adds category-specific filtering.
   */
  @Get("by-category/:category")
  @ApiOperation({ summary: "Get all dummies in a specific category" })
  async findByCategory(
    @Param("category") category: string,
  ): Promise<BaseResponseDto<DummyPublic[]>> {
    const dummies = await this.dummiesService.findByCategory(category);
    return BaseResponseDto.ok(dummies);
  }
}
