import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { notifyUsers, getOrgSubsidiaryUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const currentYear = new Date().getFullYear()

    const [organizations, demands] = await Promise.all([
      prisma.organization.findMany({
        include: {
          _count: { select: { users: true, demands: true } },
          spWallets: {
            where: { year: currentYear },
            select: { totalQuota: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.demand.findMany({
        where: { status: { in: ["DEVELOPING", "ACCEPTANCE", "CLOSED"] } },
        select: { organizationId: true, status: true, confirmedSp: true, estimatedSp: true },
      }),
    ])

    // Compute committed / used SP from actual demand statuses
    const spByOrg: Record<string, { committed: number; used: number }> = {}
    for (const d of demands) {
      const sp = d.confirmedSp ?? d.estimatedSp
      if (!spByOrg[d.organizationId]) spByOrg[d.organizationId] = { committed: 0, used: 0 }
      if (d.status === "CLOSED") {
        spByOrg[d.organizationId].used += sp
      } else {
        spByOrg[d.organizationId].committed += sp
      }
    }

    const result = organizations.map((org) => {
      const wallet = org.spWallets[0]
      const sp = spByOrg[org.id] ?? { committed: 0, used: 0 }
      return {
        id: org.id,
        code: org.code,
        name: org.name,
        fullName: org.fullName,
        status: org.status,
        userCount: org._count.users,
        demandCount: org._count.demands,
        spQuota: wallet?.totalQuota ?? 0,
        spUsed: sp.used,
        spCommitted: sp.committed,
      }
    })

    const totalUsers = result.reduce((s, o) => s + o.userCount, 0)
    const totalSpQuota = result.reduce((s, o) => s + o.spQuota, 0)
    const totalSpUsed = result.reduce((s, o) => s + o.spUsed, 0)
    const totalSpCommitted = result.reduce((s, o) => s + o.spCommitted, 0)

    return NextResponse.json({
      organizations: result,
      summary: {
        orgCount: result.length,
        totalUsers,
        totalSpQuota,
        totalSpUsed,
        totalSpCommitted,
        year: currentYear,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin organizations error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    const body = await request.json()
    const { id, spQuota } = body

    if (!id) {
      return NextResponse.json({ error: "缺少組織 ID" }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()

    if (spQuota !== undefined) {
      await prisma.spWallet.upsert({
        where: { organizationId_year: { organizationId: id, year: currentYear } },
        create: { organizationId: id, year: currentYear, totalQuota: spQuota },
        update: { totalQuota: spQuota },
      })
    }

    // Fire-and-forget: notify org subsidiary users + audit
    if (spQuota !== undefined) {
      getOrgSubsidiaryUserIds(id).then((orgIds) => {
        const recipients = orgIds.filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "SP_CHANGE",
          title: "SP 額度變更",
          message: `您所屬組織的 SP 額度已更新為 ${spQuota}。`,
          linkUrl: `/dashboard`,
        })
      })
    }
    logAudit({
      userId: auth.userId,
      action: "UPDATE",
      entity: "ORGANIZATION",
      entityId: id,
      details: { spQuota },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin update organization error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
