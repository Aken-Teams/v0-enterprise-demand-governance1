import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { calcUsedSp, calcCommittedSp, calcPlannedSp } from "@/lib/constants/demand"

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
          heldFromStatus: true, devLinkConfirmedAt: true,
          isTerminated: true,
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
    type WalletDemand = {
      id: string; demandNumber: string; title: string; status: string; vendor: string
      sp: number; estimatedSp: number; spUsed: number; spCommitted: number; spPlanned: number; settlementType: string | null
      isTerminated: boolean; updatedAt: Date
    }
    const vendorMap = new Map<string, {
      totalQuota: number; usedSp: number; committedSp: number; plannedSp: number
      demands: WalletDemand[]
    }>()

    // Initialize with wallets
    for (const w of wallets) {
      vendorMap.set(w.vendor, { totalQuota: w.totalQuota, usedSp: 0, committedSp: 0, plannedSp: 0, demands: [] })
    }

    for (const d of demands) {
      const sp = d.confirmedSp ?? d.estimatedSp
      const spUsed = calcUsedSp(d.status, sp, d.heldFromStatus, !!d.devLinkConfirmedAt)
      // 已開案但還沒走到認列節點的部分——必然會發生，只是時間未到
      const spCommitted = calcCommittedSp(d.status, sp, !!d.devLinkConfirmedAt)
      // 已提出但還沒開案（或暫緩）的部分——最不確定的一層
      const spPlanned = calcPlannedSp(d.status, sp, d.heldFromStatus, !!d.devLinkConfirmedAt)
      if (!vendorMap.has(d.vendor)) {
        vendorMap.set(d.vendor, { totalQuota: walletMap.get(d.vendor) ?? 0, usedSp: 0, committedSp: 0, plannedSp: 0, demands: [] })
      }
      const entry = vendorMap.get(d.vendor)!
      entry.usedSp += spUsed
      entry.committedSp += spCommitted
      entry.plannedSp += spPlanned
      const isAdjusted = d.confirmedSp != null && d.confirmedSp !== d.estimatedSp
      const settlementType = isAdjusted
        ? (d.phaseSignoffs.length > 0 ? "override" : "adjustment")
        : null
      entry.demands.push({
        id: d.id, demandNumber: d.demandNumber, title: d.title,
        status: d.status, vendor: d.vendor, sp, estimatedSp: d.estimatedSp, spUsed, spCommitted, spPlanned, settlementType,
        isTerminated: d.isTerminated, updatedAt: d.updatedAt,
      })
    }

    // Build response with both combined totals and per-vendor breakdown
    let totalQuota = 0
    let totalUsedSp = 0
    let totalCommittedSp = 0
    let totalPlannedSp = 0
    const byVendor: { vendor: string; totalQuota: number; usedSp: number; committedSp: number; plannedSp: number; availableSp: number; plannableSp: number; demands: WalletDemand[] }[] = []

    for (const [vendor, data] of vendorMap) {
      totalQuota += data.totalQuota
      totalUsedSp += data.usedSp
      totalCommittedSp += data.committedSp
      totalPlannedSp += data.plannedSp
      byVendor.push({
        vendor,
        totalQuota: data.totalQuota,
        usedSp: data.usedSp,
        committedSp: data.committedSp,
        plannedSp: data.plannedSp,
        availableSp: data.totalQuota - data.usedSp,
        // 扣掉三層之後，真正還能拿來提新需求的額度
        plannableSp: data.totalQuota - data.usedSp - data.committedSp - data.plannedSp,
        demands: data.demands,
      })
    }

    return NextResponse.json({
      year: currentYear,
      totalQuota,
      usedSp: totalUsedSp,
      committedSp: totalCommittedSp,
      plannedSp: totalPlannedSp,
      availableSp: totalQuota - totalUsedSp,
      plannableSp: totalQuota - totalUsedSp - totalCommittedSp - totalPlannedSp,
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
