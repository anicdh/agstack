/**
 * UpdateDummyDto — validates PATCH /dummies/:id request body.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: PartialType of CreateDto, minus sensitive fields (secretNote).
 * Only fields present in the request body will be updated.
 */

import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateDummyDto } from "./create-dummy.dto";

export class UpdateDummyDto extends PartialType(
  OmitType(CreateDummyDto, ["secretNote"] as const),
) {}
