import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    // Look up user to get organizationId
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { organizationId: true },
    })

    if (!user?.organizationId) {
      return NextResponse.json({ error: "使用者未關聯組織" }, { status: 400 })
    }

    const orgId = user.organizationId
    const currentYear = new Date().getFullYear()

    // Fetch all data in parallel
    const [wallet, demands, recentHistory, acceptanceRecords] = await Promise.all([
      // SP wallet
      prisma.spWallet.findUnique({
        where: {
          organizationId_year: { organizationId: orgId, year: currentYear },
        },
        select: { totalQuota: true, usedSp: true, committedSp: true },
      }),
      // All demands for this org
      prisma.demand.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          demandNumber: true,
          title: true,
          status: true,
          priority: true,
          estimatedSp: true,
          confirmedSp: true,
          createdAt: true,
          completedDate: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      // Recent status changes (for activity feed)
      prisma.demandStatusHistory.findMany({
        where: { demand: { organizationId: orgId } },
        include: {
          demand: { select: { demandNumber: true, title: true, estimatedSp: true, confirmedSp: true, priority: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Acceptance records (for pass rate)
      prisma.acceptanceRecord.findMany({
        where: { demand: { organizationId: orgId } },
        select: { result: true },
      }),
    ])

    // --- KPI calculations ---
    const totalDemands = demands.length
    const inProgressStatuses = new Set(["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE"])
    const inProgress = demands.filter((d) => inProgressStatuses.has(d.status)).length
    const completed = demands.filter((d) => d.status === "CLOSED").length

    // SP data
    const totalQuota = wallet?.totalQuota ?? 0
    let usedSp = 0
    let committedSp = 0
    for (const d of demands) {
      if (d.status === "REJECTED") continue
      const sp = d.confirmedSp ?? d.estimatedSp
      if (d.status === "CLOSED") usedSp += sp
      else if (d.status === "DEVELOPING" || d.status === "ACCEPTANCE") committedSp += sp
    }
    const availableSp = totalQuota - usedSp - committedSp

    // Completion rate (completed / total excluding rejected)
    const nonRejected = demands.filter((d) => d.status !== "REJECTED").length
    const completionRate = nonRejected > 0 ? Math.round((completed / nonRejected) * 100) : 0

    // Acceptance pass rate
    const totalAcceptance = acceptanceRecords.length
    const passedAcceptance = acceptanceRecords.filter((r) => r.result === "PASS").length
    const passRate = totalAcceptance > 0 ? Math.round((passedAcceptance / totalAcceptance) * 100) : 0

    // Average processing time (days from createdAt to completedDate for CLOSED demands)
    const closedDemands = demands.filter((d) => d.status === "CLOSED" && d.completedDate)
    let avgDays = 0
    if (closedDemands.length > 0) {
      const totalDays = closedDemands.reduce((sum, d) => {
        const diff = new Date(d.completedDate!).getTime() - new Date(d.createdAt).getTime()
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)
      avgDays = Math.round((totalDays / closedDemands.length) * 10) / 10
    }

    // --- Monthly trends (last 6 months) ---
    const now = new Date()
    const monthlyTrends: { month: string; submitted: number; completed: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const monthLabel = d.toLocaleString("en-US", { month: "short" })

      const submitted = demands.filter(
        (dem) => new Date(dem.createdAt) >= monthStart && new Date(dem.createdAt) < monthEnd
      ).length
      const completedInMonth = demands.filter(
        (dem) =>
          dem.completedDate &&
          new Date(dem.completedDate) >= monthStart &&
          new Date(dem.completedDate) < monthEnd
      ).length

      monthlyTrends.push({ month: monthLabel, submitted, completed: completedInMonth })
    }

    // --- Recent activity ---
    const STATUS_LABELS: Record<string, string> = {
      SUBMITTED: "需求提出",
      PRD_REVIEW: "PRD 確認中",
      SP_REVIEW: "SP 確認中",
      DEVELOPING: "開發中",
      ACCEPTANCE: "驗收中",
      CLOSED: "已結案",
      REJECTED: "已駁回",
    }

    const PRIORITY_LABELS: Record<string, string> = {
      low: "低",
      medium: "中",
      high: "高",
      critical: "緊急",
    }

    const recentActivity = recentHistory.map((h) => ({
      action: STATUS_LABELS[h.toStatus] ?? h.toStatus,
      title: h.demand.title,
      demandNumber: h.demand.demandNumber,
      time: h.createdAt,
      sp: h.demand.confirmedSp ?? h.demand.estimatedSp,
      priority: PRIORITY_LABELS[h.demand.priority] ?? h.demand.priority,
      status: h.toStatus === "CLOSED" ? "success" : h.toStatus === "REJECTED" ? "warning" : "info",
    }))

    return NextResponse.json({
      kpi: {
        totalDemands,
        inProgress,
        completed,
        completionRate,
      },
      sp: {
        totalQuota,
        usedSp,
        committedSp,
        availableSp,
        availablePercent: totalQuota > 0 ? Math.round((availableSp / totalQuota) * 1000) / 10 : 0,
      },
      performance: {
        deliveryRate: completionRate,
        passRate,
        avgProcessingDays: avgDays,
      },
      monthlyTrends,
      recentActivity,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Subsidiary dashboard error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
