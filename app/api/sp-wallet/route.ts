import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { calcUsedSp } from "@/lib/constants/demand"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    // Look up user + check if restricted
    const [user, accessCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { organizationId: true },
      }),
      prisma.demandAccess.count({ where: { userId: auth.userId } }),
    ])

    // Restricted users (with DemandAccess whitelist) cannot access SP wallet
    if (accessCount > 0) {
      return NextResponse.json({ error: "您的帳號無權查看 SP 錢包" }, { status: 403 })
    }

    if (!user?.organizationId) {
      return NextResponse.json({ error: "使用者未關聯組織" }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()

    // Fetch wallets (per vendor) and demands in parallel
    const [wallets, demands] = await Promise.all([
      prisma.spWallet.findMany({
        where: { organizationId: user.organizationId, year: currentYear },
        select: { vendor: true, totalQuota: true },
      }),
      prisma.demand.findMany({
        where: { organizationId: user.organizationId },
        select: {
          id: true,
          demandNumber: true,
          title: true,
          status: true,
          vendor: true,
          estimatedSp: true,
          confirmedSp: true,
          heldFromStatus: true,
          createdAt: true,
          updatedAt: true,
          phaseSignoffs: {
            where: { targetRole: "BOARD_OVERRIDE", status: "APPROVED" },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ])

    // Build per-vendor breakdown
    const walletMap = new Map(wallets.map((w) => [w.vendor, w.totalQuota]))
    const vendorMap = new Map<string, {
      totalQuota: number; usedSp: number
      demands: { id: string; demandNumber: string; title: string; status: string; vendor: string; sp: number; estimatedSp: number; spUsed: number; settlementType: string | null; updatedAt: Date }[]
    }>()

    // Initialize with wallets
    for (const w of wallets) {
      vendorMap.set(w.vendor, { totalQuota: w.totalQuota, usedSp: 0, demands: [] })
    }

    for (const d of demands) {
      const sp = d.confirmedSp ?? d.estimatedSp
      const spUsed = calcUsedSp(d.status, sp, d.heldFromStatus)
      if (!vendorMap.has(d.vendor)) {
        vendorMap.set(d.vendor, { totalQuota: walletMap.get(d.vendor) ?? 0, usedSp: 0, demands: [] })
      }
      const entry = vendorMap.get(d.vendor)!
      entry.usedSp += spUsed
      const isAdjusted = d.confirmedSp != null && d.confirmedSp !== d.estimatedSp
      const settlementType = isAdjusted
        ? (d.phaseSignoffs.length > 0 ? "override" : "adjustment")
        : null
      entry.demands.push({
        id: d.id, demandNumber: d.demandNumber, title: d.title,
        status: d.status, vendor: d.vendor, sp, estimatedSp: d.estimatedSp, spUsed, settlementType, updatedAt: d.updatedAt,
      })
    }

    // Build response with both combined totals and per-vendor breakdown
    let totalQuota = 0
    let totalUsedSp = 0
    const byVendor: { vendor: string; totalQuota: number; usedSp: number; availableSp: number; demands: typeof demands }[] = []

    for (const [vendor, data] of vendorMap) {
      totalQuota += data.totalQuota
      totalUsedSp += data.usedSp
      byVendor.push({
        vendor,
        totalQuota: data.totalQuota,
        usedSp: data.usedSp,
        availableSp: data.totalQuota - data.usedSp,
        demands: data.demands as typeof demands,
      })
    }

    return NextResponse.json({
      year: currentYear,
      totalQuota,
      usedSp: totalUsedSp,
      availableSp: totalQuota - totalUsedSp,
      byVendor,
      // Legacy: flat demands list (all vendors combined)
      demands: byVendor.flatMap((v) => v.demands),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("SP wallet error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
