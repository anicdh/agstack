/**
 * CreateDummyDto — validates POST /dummies request body.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: one DTO class per operation. Use class-validator decorators.
 * Mirrors Zod schema in /shared/types/dummy.ts.
 */

import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum DummyStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum DummyCategory {
  ALPHA = "ALPHA",
  BETA = "BETA",
  GAMMA = "GAMMA",
}

export class CreateDummyDto {
  @ApiProperty({ example: "Dummy Alpha" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "dummy@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: DummyStatus, default: DummyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(DummyStatus)
  status?: DummyStatus | undefined = DummyStatus.ACTIVE;

  @ApiProperty({ enum: DummyCategory })
  @IsEnum(DummyCategory)
  category!: DummyCategory;

  @ApiPropertyOptional({ example: "A sample dummy entry for demonstration" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null | undefined;

  @ApiProperty({ example: "This is a secret note" })
  @IsString()
  @MaxLength(200)
  secretNote!: string;
}
