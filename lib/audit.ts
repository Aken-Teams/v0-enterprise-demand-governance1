import { prisma } from "@/lib/prisma"
import type { NextRequest } from "next/server"

interface AuditInput {
  userId: string
  action: string
  entity: string
  entityId: string
  demandId?: string | null
  details?: Record<string, unknown>
  request?: NextRequest
}

/**
 * Logs an audit trail entry. Fire-and-forget: errors logged but never thrown.
 */
export async function logAudit(data: AuditInput): Promise<void> {
  try {
    let ipAddress: string | null = null
    if (data.request) {
      ipAddress =
        data.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        data.request.headers.get("x-real-ip") ??
        null
    }

    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        demandId: data.demandId ?? null,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress,
      },
    })
  } catch (error) {
    console.error("Failed to create audit log:", error)
  }
}
