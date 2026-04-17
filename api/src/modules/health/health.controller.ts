/**
 * HealthController — liveness + readiness check.
 *
 * GET /api/v1/health → { status: "ok", timestamp, uptime, db }
 *
 * Used by:
 * - /setup to verify the API is running after scaffold
 * - Load balancers / container orchestrators for health probes
 * - Frontend home page to show API connection status
 */

import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../common/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Health check" })
  async check(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    db: string;
  }> {
    let dbStatus = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    const status = dbStatus === "ok" ? "ok" : "degraded";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: dbStatus,
    };
  }
}
