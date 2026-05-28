import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { notifyUsers, getOrgSubsidiaryUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import { calcUsedSp } from "@/lib/constants/demand"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const currentYear = new Date().getFullYear()

    const [organizations, demands] = await Promise.all([
      prisma.organization.findMany({
        include: {
          _count: { select: { users: true, demands: true } },
          spWallets: {
            where: { year: currentYear },
            select: { vendor: true, totalQuota: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.demand.findMany({
        where: { status: { not: "REJECTED" } },
        select: { organizationId: true, vendor: true, status: true, confirmedSp: true, estimatedSp: true, heldFromStatus: true },
      }),
    ])

    // Compute progressive used SP from actual demand statuses, grouped by org+vendor
    const spByOrgVendor: Record<string, Record<string, number>> = {}
    for (const d of demands) {
      const sp = d.confirmedSp ?? d.estimatedSp
      if (!spByOrgVendor[d.organizationId]) spByOrgVendor[d.organizationId] = {}
      if (!spByOrgVendor[d.organizationId][d.vendor]) spByOrgVendor[d.organizationId][d.vendor] = 0
      spByOrgVendor[d.organizationId][d.vendor] += calcUsedSp(d.status, sp, d.heldFromStatus)
    }

    const result = organizations.map((org) => {
      const vendorWallets = org.spWallets.map((w) => ({
        vendor: w.vendor,
        totalQuota: w.totalQuota,
        usedSp: Math.round(spByOrgVendor[org.id]?.[w.vendor] ?? 0),
      }))
      // Total across all vendors
      const totalQuota = vendorWallets.reduce((s, v) => s + v.totalQuota, 0)
      const totalUsed = vendorWallets.reduce((s, v) => s + v.usedSp, 0)
      return {
        id: org.id,
        code: org.code,
        name: org.name,
        fullName: org.fullName,
        status: org.status,
        userCount: org._count.users,
        demandCount: org._count.demands,
        spQuota: totalQuota,
        spUsed: totalUsed,
        vendorWallets,
      }
    })

    const totalUsers = result.reduce((s, o) => s + o.userCount, 0)
    const totalSpQuota = result.reduce((s, o) => s + o.spQuota, 0)
    const totalSpUsed = result.reduce((s, o) => s + o.spUsed, 0)

    // Per-vendor summary across all orgs
    const vendorTotals: Record<string, { totalQuota: number; usedSp: number }> = {}
    for (const org of result) {
      for (const vw of org.vendorWallets) {
        if (!vendorTotals[vw.vendor]) vendorTotals[vw.vendor] = { totalQuota: 0, usedSp: 0 }
        vendorTotals[vw.vendor].totalQuota += vw.totalQuota
        vendorTotals[vw.vendor].usedSp += vw.usedSp
      }
    }
    const byVendor = Object.entries(vendorTotals).sort(([a], [b]) => a.localeCompare(b)).map(([vendor, data]) => ({
      vendor,
      totalQuota: data.totalQuota,
      usedSp: data.usedSp,
      availableSp: data.totalQuota - data.usedSp,
    }))

    return NextResponse.json({
      organizations: result,
      summary: {
        orgCount: result.length,
        totalUsers,
        totalSpQuota,
        totalSpUsed,
        year: currentYear,
        byVendor,
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

export async function POST(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)
    const { code, name, fullName } = await request.json()

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "請提供代碼和名稱" }, { status: 400 })
    }

    const existing = await prisma.organization.findUnique({ where: { code: code.trim() } })
    if (existing) {
      return NextResponse.json({ error: `代碼「${code.trim()}」已存在` }, { status: 400 })
    }

    const org = await prisma.organization.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        fullName: fullName?.trim() || null,
      },
    })

    // Create SP wallets for all existing vendors
    const currentYear = new Date().getFullYear()
    const [demandVendors, walletVendors] = await Promise.all([
      prisma.demand.findMany({ select: { vendor: true }, distinct: ["vendor"] }),
      prisma.spWallet.findMany({ select: { vendor: true }, distinct: ["vendor"] }),
    ])
    const allVendors = Array.from(new Set([
      ...demandVendors.map((d) => d.vendor),
      ...walletVendors.map((w) => w.vendor),
    ]))
    if (allVendors.length > 0) {
      await prisma.spWallet.createMany({
        data: allVendors.map((vendor) => ({
          organizationId: org.id,
          year: currentYear,
          vendor,
          totalQuota: 0,
          usedSp: 0,
        })),
        skipDuplicates: true,
      })
    }

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "ORGANIZATION",
      entityId: org.id,
      details: { code: org.code, name: org.name },
      request,
    })

    return NextResponse.json({ success: true, organization: org })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin create organization error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)
    const body = await request.json()
    const { id, spQuota, vendor = "JV" } = body

    if (!id) {
      return NextResponse.json({ error: "缺少組織 ID" }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()

    if (spQuota !== undefined) {
      await prisma.spWallet.upsert({
        where: {
          organizationId_year_vendor: { organizationId: id, year: currentYear, vendor },
        },
        create: { organizationId: id, year: currentYear, vendor, totalQuota: spQuota },
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
          message: `您所屬組織的 ${vendor} SP 額度已更新為 ${spQuota}。`,
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
