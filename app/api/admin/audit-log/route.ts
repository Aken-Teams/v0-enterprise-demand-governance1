import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"

// GET: Query audit logs (admin only)
export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))
    const entity = searchParams.get("entity")
    const action = searchParams.get("action")
    const userId = searchParams.get("userId")
    const demandId = searchParams.get("demandId")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (entity) where.entity = entity
    if (action) where.action = action
    if (userId) where.userId = userId
    if (demandId) where.demandId = demandId
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z")
    }

    const [rawLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          demand: { select: { id: true, demandNumber: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    // Resolve organizationId in details to org names
    const orgIds = new Set<string>()
    for (const log of rawLogs) {
      if (log.details) {
        try {
          const d = JSON.parse(log.details)
          if (d.organizationId && typeof d.organizationId === "string") orgIds.add(d.organizationId)
        } catch { /* ignore */ }
      }
    }
    const orgMap = new Map<string, string>()
    if (orgIds.size > 0) {
      const orgs = await prisma.organization.findMany({
        where: { id: { in: [...orgIds] } },
        select: { id: true, name: true },
      })
      for (const o of orgs) orgMap.set(o.id, o.name)
    }

    const logs = rawLogs.map((log) => {
      let details = log.details
      if (details) {
        try {
          const d = JSON.parse(details)
          if (d.organizationId && orgMap.has(d.organizationId)) {
            d.organization = orgMap.get(d.organizationId)
            delete d.organizationId
            details = JSON.stringify(d)
          }
        } catch { /* ignore */ }
      }
      return {
        id: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        demandId: log.demandId,
        details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
        user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
        demand: log.demand ? { id: log.demand.id, demandNumber: log.demand.demandNumber, title: log.demand.title } : null,
      }
    })

    return NextResponse.json({ logs, total, page, limit })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Audit log query error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
