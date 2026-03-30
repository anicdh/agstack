/**
 * DummiesModule — NestJS module for the reference Dummies feature.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new modules.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN: One module per feature domain. Module wires controller + service + dependencies.
 * Register in AppModule imports.
 */

import { Module } from "@nestjs/common";
import { PrismaService } from "@/common/prisma.service";
import { DummiesController } from "./dummies.controller";
import { DummiesService } from "./dummies.service";

@Module({
  controllers: [DummiesController],
  providers: [PrismaService, DummiesService],
  exports: [DummiesService], // Export if other modules need it
})
export class DummiesModule {}
