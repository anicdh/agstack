/**
 * PrismaService — NestJS-managed Prisma client.
 *
 * Inject this service into any module that needs database access.
 * Handles connection lifecycle (connect on init, disconnect on destroy).
 *
 * @example
 * // In a module:
 * @Module({
 *   providers: [PrismaService, MyService],
 * })
 *
 * // In a service:
 * constructor(private readonly prisma: PrismaService) {
 *   super(prisma, "modelName");
 * }
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connected to database");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log("Prisma disconnected from database");
  }
}
