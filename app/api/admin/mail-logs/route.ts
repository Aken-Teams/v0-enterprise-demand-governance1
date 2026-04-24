import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"

/**
 * GET /api/admin/mail-logs
 * 查詢郵件發送紀錄（分頁）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 20))
    const type = searchParams.get("type") // SIGNOFF_NOTIFY | MONTHLY_REPORT
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    const where: Record<string, unknown> = {}

    if (type && (type === "SIGNOFF_NOTIFY" || type === "MONTHLY_REPORT")) {
      where.type = type
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        createdAt.lte = end
      }
      where.createdAt = createdAt
    }

    const [logs, total] = await Promise.all([
      prisma.mailLog.findMany({
        where,
        include: {
          sentBy: { select: { id: true, name: true } },
          demand: { select: { id: true, demandNumber: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.mailLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("GET /api/admin/mail-logs error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
