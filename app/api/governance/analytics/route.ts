import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const currentYear = new Date().getFullYear()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Fetch all data in parallel
    const [demands, wallets, statusHistories, allOrgs] = await Promise.all([
      prisma.demand.findMany({
        select: {
          id: true,
          demandNumber: true,
          title: true,
          status: true,
          priority: true,
          estimatedSp: true,
          confirmedSp: true,
          desiredDate: true,
          expectedDate: true,
          completedDate: true,
          createdAt: true,
          updatedAt: true,
          organizationId: true,
          organization: { select: { name: true } },
          developer: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.spWallet.findMany({
        where: { year: currentYear },
        select: {
          totalQuota: true,
          usedSp: true,
          committedSp: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.demandStatusHistory.findMany({
        select: {
          demandId: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findMany({
        where: { status: "active" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ])

    // --- KPI ---
    const activeStatuses = new Set(["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE"])
    const activeDemands = demands.filter((d) => activeStatuses.has(d.status)).length

    const thisMonthClosed = demands.filter(
      (d) =>
        d.status === "CLOSED" &&
        d.completedDate &&
        new Date(d.completedDate) >= monthStart &&
        new Date(d.completedDate) < monthEnd
    ).length

    // YTD SP
    const yearStart = new Date(currentYear, 0, 1)
    let ytdUsedSp = 0
    for (const d of demands) {
      if (d.status === "CLOSED" && d.completedDate && new Date(d.completedDate) >= yearStart) {
        ytdUsedSp += d.confirmedSp ?? d.estimatedSp
      }
    }

    // Delivery efficiency: avg days for closed demands
    const closedDemands = demands.filter((d) => d.status === "CLOSED" && d.completedDate)
    let avgDays = 0
    if (closedDemands.length > 0) {
      const totalDays = closedDemands.reduce((sum, d) => {
        const diff = new Date(d.completedDate!).getTime() - new Date(d.createdAt).getTime()
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)
      avgDays = Math.round((totalDays / closedDemands.length) * 10) / 10
    }

    // --- Status distribution ---
    const statusCounts: Record<string, number> = {}
    for (const d of demands) {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
    }

    // --- Organization demand distribution ---
    const orgDemandCounts: Record<string, number> = {}
    for (const d of demands) {
      const name = d.organization.name
      orgDemandCounts[name] = (orgDemandCounts[name] || 0) + 1
    }

    // --- Developer demand distribution ---
    const devDemandCounts: Record<string, number> = {}
    for (const d of demands) {
      const name = d.developer?.name ?? "未指派"
      devDemandCounts[name] = (devDemandCounts[name] || 0) + 1
    }

    // --- Monthly trends (last 8 months) ---
    const monthlyTrends: { month: string; submitted: number; completed: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const monthLabel = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`

      const submitted = demands.filter(
        (dem) => new Date(dem.createdAt) >= mStart && new Date(dem.createdAt) < mEnd
      ).length
      const completed = demands.filter(
        (dem) =>
          dem.completedDate &&
          new Date(dem.completedDate) >= mStart &&
          new Date(dem.completedDate) < mEnd
      ).length

      monthlyTrends.push({ month: monthLabel, submitted, completed })
    }

    // --- Organization SP breakdown (all orgs) ---
    const walletMap = new Map(wallets.map((w) => [w.organizationId, w]))
    const orgSpData = allOrgs.map((org) => {
      const w = walletMap.get(org.id)
      const orgDemands = demands.filter((d) => d.organizationId === org.id)
      let usedSp = 0
      let committedSp = 0
      for (const d of orgDemands) {
        if (d.status === "REJECTED") continue
        const sp = d.confirmedSp ?? d.estimatedSp
        if (d.status === "CLOSED") usedSp += sp
        else if (d.status === "DEVELOPING" || d.status === "ACCEPTANCE") committedSp += sp
      }
      const totalQuota = w?.totalQuota ?? 0
      return {
        name: org.name,
        totalQuota,
        usedSp,
        committedSp,
        availableSp: totalQuota - usedSp - committedSp,
        demandCount: orgDemands.length,
      }
    })

    // Global SP totals
    const totalQuota = wallets.reduce((s, w) => s + w.totalQuota, 0)
    const totalUsedSp = orgSpData.reduce((s, o) => s + o.usedSp, 0)
    const totalCommittedSp = orgSpData.reduce((s, o) => s + o.committedSp, 0)

    // --- On-time delivery rate ---
    // Use expectedDate first, fall back to desiredDate
    const deliverableDemands = demands.filter(
      (d) => d.status === "CLOSED" && d.completedDate && (d.expectedDate || d.desiredDate)
    )
    const onTimeCount = deliverableDemands.filter(
      (d) => new Date(d.completedDate!) <= new Date((d.expectedDate ?? d.desiredDate)!)
    ).length
    const onTimeRate = deliverableDemands.length > 0
      ? Math.round((onTimeCount / deliverableDemands.length) * 100)
      : 0

    // --- Pass rate ---
    const passStatuses = new Set(["SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "CLOSED"])
    const passEligible = demands.filter((d) => passStatuses.has(d.status))
    const passClosed = passEligible.filter((d) => d.status === "CLOSED").length
    const passRate = passEligible.length > 0
      ? Math.round((passClosed / passEligible.length) * 100)
      : 0

    // --- Risk: overdue demands ---
    const overdueDemands = demands
      .filter(
        (d) =>
          activeStatuses.has(d.status) &&
          (d.expectedDate || d.desiredDate) &&
          new Date((d.expectedDate ?? d.desiredDate)!) < now
      )
      .map((d) => {
        const dueDate = (d.expectedDate ?? d.desiredDate)!
        return {
          demandNumber: d.demandNumber,
          title: d.title,
          status: d.status,
          organization: d.organization.name,
          expectedDate: dueDate,
          overdueDays: Math.ceil(
            (now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }
      })
      .sort((a, b) => b.overdueDays - a.overdueDays)

    // --- Risk: stale demands (no update in 14+ days) ---
    const staleDays = 14
    const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000)
    const staleDemands = demands
      .filter(
        (d) =>
          activeStatuses.has(d.status) &&
          new Date(d.updatedAt) < staleThreshold
      )
      .map((d) => ({
        demandNumber: d.demandNumber,
        title: d.title,
        status: d.status,
        organization: d.organization.name,
        lastUpdated: d.updatedAt,
        idleDays: Math.ceil(
          (now.getTime() - new Date(d.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))
      .sort((a, b) => b.idleDays - a.idleDays)

    // --- Phase avg duration (from status history) ---
    const phaseOrder = ["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "CLOSED"]
    const phaseDurations: Record<string, number[]> = {}
    for (const phase of phaseOrder) phaseDurations[phase] = []

    // Group histories by demand
    const historyByDemand = new Map<string, typeof statusHistories>()
    for (const h of statusHistories) {
      const arr = historyByDemand.get(h.demandId) || []
      arr.push(h)
      historyByDemand.set(h.demandId, arr)
    }
    for (const [, entries] of historyByDemand) {
      const sorted = entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      for (let i = 0; i < sorted.length - 1; i++) {
        const phase = sorted[i].toStatus
        const days =
          (new Date(sorted[i + 1].createdAt).getTime() - new Date(sorted[i].createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        if (phaseDurations[phase] && days >= 0) {
          phaseDurations[phase].push(days)
        }
      }
    }
    const phaseAvgDays = phaseOrder.map((phase) => {
      const arr = phaseDurations[phase]
      return {
        phase,
        avgDays: arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0,
        count: arr.length,
      }
    })

    // --- Developer workload ---
    const devWorkload: Record<string, { name: string; count: number; sp: number }> = {}
    for (const d of demands) {
      if (!activeStatuses.has(d.status) || !d.developer) continue
      const key = d.developer.name
      if (!devWorkload[key]) devWorkload[key] = { name: key, count: 0, sp: 0 }
      devWorkload[key].count++
      devWorkload[key].sp += d.confirmedSp ?? d.estimatedSp
    }

    return NextResponse.json({
      kpi: {
        activeDemands,
        thisMonthClosed,
        ytdUsedSp,
        avgDays,
        totalDemands: demands.length,
      },
      statusCounts,
      orgDemandCounts,
      devDemandCounts,
      monthlyTrends,
      sp: {
        totalQuota,
        totalUsedSp,
        totalCommittedSp,
        totalAvailable: totalQuota - totalUsedSp - totalCommittedSp,
        byOrganization: orgSpData,
      },
      performance: {
        onTimeRate,
        onTimeCount,
        deliverableTotal: deliverableDemands.length,
        passRate,
        passClosed,
        passTotal: passEligible.length,
      },
      risks: {
        overdueDemands,
        staleDemands,
      },
      phaseAvgDays,
      devWorkload: Object.values(devWorkload).sort((a, b) => b.sp - a.sp),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Governance analytics error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
