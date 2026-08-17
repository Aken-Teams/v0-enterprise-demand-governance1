import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { calcUsedSp, SP_RATE } from "@/lib/constants/demand"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin", "viewer"])

    const currentYear = new Date().getFullYear()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Fetch all data in parallel
    const [demands, wallets, statusHistories, allOrgs, latestComments, latestSignoffs, approvedSignoffs] = await Promise.all([
      prisma.demand.findMany({
        select: {
          id: true,
          demandNumber: true,
          title: true,
          status: true,
          priority: true,
          estimatedSp: true,
          confirmedSp: true,
          heldFromStatus: true,
          desiredDate: true,
          expectedDate: true,
          completedDate: true,
          createdAt: true,
          updatedAt: true,
          vendor: true,
          organizationId: true,
          organization: { select: { name: true } },
          developer: { select: { name: true } },
          phasePlans: {
            select: { phase: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.spWallet.findMany({
        where: { year: currentYear },
        select: {
          vendor: true,
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
          comment: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findMany({
        where: { status: "active" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      // Latest comment per demand (for stale detection)
      prisma.demandComment.groupBy({
        by: ["demandId"],
        _max: { createdAt: true },
      }),
      // Latest signoff activity per demand (for stale detection)
      prisma.phaseSignoff.groupBy({
        by: ["demandId"],
        _max: { requestedAt: true, respondedAt: true },
      }),
      // Approved phase signoffs for monthly ledger (簽核為主)
      prisma.phaseSignoff.findMany({
        where: { status: "APPROVED", kind: "PHASE" },
        select: { demandId: true, phase: true, respondedAt: true },
        orderBy: { respondedAt: "desc" },
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

    // --- Build historyByDemand map (used by avgDays, delivery rate + phase duration) ---
    const historyByDemand = new Map<string, typeof statusHistories>()
    for (const h of statusHistories) {
      const arr = historyByDemand.get(h.demandId) || []
      arr.push(h)
      historyByDemand.set(h.demandId, arr)
    }

    // Avg dev days: non-rejected demands with DEVELOPING phase planned dates
    // actualStart/actualEnd are status-transition timestamps (seconds apart), not real durations
    // Use Gantt chart plannedStart as start; completedDate (if after start) or plannedEnd as end
    const devsWithDates = demands.filter((d) => {
      if (d.status === "REJECTED") return false
      const dev = d.phasePlans.find((p) => p.phase === "DEVELOPING")
      return dev?.plannedStart && (d.completedDate || dev.plannedEnd)
    })
    let avgDays = 0
    if (devsWithDates.length > 0) {
      let validCount = 0
      const totalDays = devsWithDates.reduce((sum, d) => {
        const dev = d.phasePlans.find((p) => p.phase === "DEVELOPING")!
        const start = new Date(dev.plannedStart!).getTime()
        const endRaw = d.completedDate ? new Date(d.completedDate).getTime() : null
        const end = (endRaw && endRaw >= start) ? endRaw : new Date(dev.plannedEnd!).getTime()
        const diff = end - start
        if (diff < 0) return sum
        validCount++
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)
      avgDays = validCount > 0 ? Math.round((totalDays / validCount) * 10) / 10 : 0
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
        (dem) => {
          const subPhase = dem.phasePlans.find((p) => p.phase === "SUBMITTED")
          const openDate = new Date(subPhase?.plannedStart ?? dem.createdAt)
          return openDate >= mStart && openDate < mEnd
        }
      ).length
      const completed = demands.filter(
        (dem) =>
          dem.completedDate &&
          new Date(dem.completedDate) >= mStart &&
          new Date(dem.completedDate) < mEnd
      ).length

      monthlyTrends.push({ month: monthLabel, submitted, completed })
    }

    // --- Organization SP breakdown (all orgs), with vendor sub-breakdown ---
    const orgSpData = allOrgs.map((org) => {
      const orgWallets = wallets.filter((w) => w.organizationId === org.id)
      const orgDemands = demands.filter((d) => d.organizationId === org.id)

      // Per-vendor breakdown
      const vendorSet = new Set([...orgWallets.map(w => w.vendor), ...orgDemands.map(d => d.vendor)])
      const byVendor = Array.from(vendorSet).sort().map((vendor) => {
        const w = orgWallets.find(ww => ww.vendor === vendor)
        const vDemands = orgDemands.filter(d => d.vendor === vendor)
        let usedSp = 0
        for (const d of vDemands) {
          const sp = d.confirmedSp ?? d.estimatedSp
          usedSp += calcUsedSp(d.status, sp, d.heldFromStatus)
        }
        const totalQuota = w?.totalQuota ?? 0
        return { vendor, totalQuota, usedSp, availableSp: totalQuota - usedSp, demandCount: vDemands.length }
      })

      const totalQuota = byVendor.reduce((s, v) => s + v.totalQuota, 0)
      const usedSp = byVendor.reduce((s, v) => s + v.usedSp, 0)
      return {
        name: org.name,
        totalQuota,
        usedSp,
        availableSp: totalQuota - usedSp,
        demandCount: orgDemands.length,
        byVendor,
      }
    })

    // Global SP totals + per-vendor global breakdown
    const totalQuota = wallets.reduce((s, w) => s + w.totalQuota, 0)
    const totalUsedSp = orgSpData.reduce((s, o) => s + o.usedSp, 0)

    const globalVendorSet = new Set([...wallets.map(w => w.vendor), ...demands.map(d => d.vendor)])
    const spByVendor = Array.from(globalVendorSet).sort().map((vendor) => {
      const vQuota = wallets.filter(w => w.vendor === vendor).reduce((s, w) => s + w.totalQuota, 0)
      let vUsed = 0
      for (const d of demands) {
        if (d.vendor !== vendor) continue
        const sp = d.confirmedSp ?? d.estimatedSp
        vUsed += calcUsedSp(d.status, sp, d.heldFromStatus)
      }
      return { vendor, totalQuota: vQuota, usedSp: vUsed, availableSp: vQuota - vUsed }
    })

    // --- On-time delivery rate ---
    // Include ACCEPTANCE + CLOSED (development is complete for both)
    const deliveredStatuses = new Set(["ACCEPTANCE", "CLOSED"])
    const deliverableDemands = demands.filter(
      (d) => deliveredStatuses.has(d.status) && (d.expectedDate || d.desiredDate)
    )
    // For completion date: CLOSED uses completedDate, ACCEPTANCE uses status history transition date
    const getCompletionDate = (demand: typeof demands[0]): Date | null => {
      if (demand.completedDate) return new Date(demand.completedDate)
      const history = historyByDemand.get(demand.id)
      if (history) {
        const entry = history.find((h) => h.toStatus === "ACCEPTANCE")
        if (entry) return new Date(entry.createdAt)
      }
      return new Date(demand.updatedAt) // fallback
    }
    const onTimeCount = deliverableDemands.filter((d) => {
      const completed = getCompletionDate(d)
      if (!completed) return false
      return completed <= new Date((d.expectedDate ?? d.desiredDate)!)
    }).length
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

    // --- Risk: stale demands (no activity in 14+ days) ---
    // Build last-activity map: max of updatedAt, latest status change, comment, signoff
    const lastCommentMap = new Map(latestComments.map((c) => [c.demandId, c._max.createdAt]))
    const lastSignoffMap = new Map(latestSignoffs.map((s) => [s.demandId, { requestedAt: s._max.requestedAt, respondedAt: s._max.respondedAt }]))

    const getLastActivity = (demandId: string, updatedAt: Date): Date => {
      const candidates: Date[] = [new Date(updatedAt)]
      // Latest status history
      const history = historyByDemand.get(demandId)
      if (history && history.length > 0) {
        const latest = history.reduce((max, h) => new Date(h.createdAt) > max ? new Date(h.createdAt) : max, new Date(0))
        candidates.push(latest)
      }
      // Latest comment
      const commentDate = lastCommentMap.get(demandId)
      if (commentDate) candidates.push(new Date(commentDate))
      // Latest signoff activity
      const signoff = lastSignoffMap.get(demandId)
      if (signoff?.requestedAt) candidates.push(new Date(signoff.requestedAt))
      if (signoff?.respondedAt) candidates.push(new Date(signoff.respondedAt))
      return new Date(Math.max(...candidates.map((d) => d.getTime())))
    }

    const staleDays = 14
    const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000)
    const staleDemands = demands
      .filter((d) => activeStatuses.has(d.status))
      .map((d) => {
        const lastActivity = getLastActivity(d.id, d.updatedAt)
        return {
          demandNumber: d.demandNumber,
          title: d.title,
          status: d.status,
          organization: d.organization.name,
          lastUpdated: lastActivity,
          idleDays: Math.ceil(
            (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
          ),
        }
      })
      .filter((d) => d.idleDays >= staleDays)
      .sort((a, b) => b.idleDays - a.idleDays)

    // --- Phase avg duration (from status history) ---
    const phaseOrder = ["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "CLOSED"]
    const phaseDurations: Record<string, number[]> = {}
    for (const phase of phaseOrder) phaseDurations[phase] = []

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
    const devWorkload: Record<string, { name: string; count: number; usedSp: number; totalSp: number }> = {}
    for (const d of demands) {
      if (d.status === "REJECTED" || !d.developer) continue
      const key = d.developer.name
      if (!devWorkload[key]) devWorkload[key] = { name: key, count: 0, usedSp: 0, totalSp: 0 }
      devWorkload[key].count++
      const sp = d.confirmedSp ?? d.estimatedSp ?? 0
      devWorkload[key].totalSp += sp
      devWorkload[key].usedSp += calcUsedSp(d.status, sp, d.heldFromStatus)
    }

    // --- Financial data (permission-gated) ---
    type LedgerDetail = { demandNumber: string; title: string; vendor: string; fromStatus: string | null; toStatus: string; sp: number; deltaSp: number; deltaAmount: number; date: string; spChange?: { from: number; to: number; reason: string } }
    type MonthlyLedgerOrg = { organization: string; deltaSp: number; deltaAmount: number; details: LedgerDetail[] }
    type MonthlyLedger = { month: string; data: MonthlyLedgerOrg[] }

    type VendorFinancial = { vendor: string; quotaSp: number; quotaAmount: number; totalSp: number; usedSp: number; amount: number; usedAmount: number; demandCount: number }

    let financial: {
      totalQuotaSp: number
      totalQuotaAmount: number
      vendorSummary: VendorFinancial[]
      orgSummary: { name: string; quotaSp: number; quotaAmount: number; totalSp: number; usedSp: number; amount: number; usedAmount: number; demandCount: number; byVendor: VendorFinancial[] }[]
      demandDetail: { organization: string; demandNumber: string; title: string; status: string; vendor: string; sp: number; usedSp: number; amount: number; usedAmount: number }[]
      monthlyLedger: MonthlyLedger[]
    } | null = null

    const userRecord = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { canViewFinancial: true },
    })

    if (userRecord?.canViewFinancial) {
      // Org summary — include wallet quota for budget context, with per-vendor breakdown
      const orgSummary = allOrgs.map((org) => {
        const orgWallets = wallets.filter((w) => w.organizationId === org.id)
        // 已駁回與已取消都不佔用預算（取消會釋放 SP），故排除於「已提出」之外
        const orgDemands = demands.filter((d) => d.organizationId === org.id && d.status !== "REJECTED" && d.status !== "CANCELLED")

        // Per-vendor breakdown
        const vendorSet = new Set([...orgWallets.map(w => w.vendor), ...orgDemands.map(d => d.vendor)])
        const byVendor = Array.from(vendorSet).sort().map((vendor) => {
          const w = orgWallets.find(ww => ww.vendor === vendor)
          const vDemands = orgDemands.filter(d => d.vendor === vendor)
          let totalSp = 0, usedSp = 0
          for (const dem of vDemands) {
            const sp = dem.confirmedSp ?? dem.estimatedSp ?? 0
            totalSp += sp
            usedSp += calcUsedSp(dem.status, sp, dem.heldFromStatus)
          }
          const quotaSp = w?.totalQuota ?? 0
          return { vendor, quotaSp, quotaAmount: quotaSp * SP_RATE, totalSp, usedSp, amount: totalSp * SP_RATE, usedAmount: usedSp * SP_RATE, demandCount: vDemands.length }
        })

        const quotaSp = byVendor.reduce((s, v) => s + v.quotaSp, 0)
        let totalSp = 0, usedSp = 0
        for (const dem of orgDemands) {
          const sp = dem.confirmedSp ?? dem.estimatedSp ?? 0
          totalSp += sp
          usedSp += calcUsedSp(dem.status, sp, dem.heldFromStatus)
        }
        return {
          name: org.name,
          quotaSp,
          quotaAmount: quotaSp * SP_RATE,
          totalSp,
          usedSp,
          amount: totalSp * SP_RATE,
          usedAmount: usedSp * SP_RATE,
          demandCount: orgDemands.length,
          byVendor,
        }
      }).filter((o) => o.demandCount > 0 || o.quotaSp > 0)

      const totalQuotaSp = orgSummary.reduce((s, o) => s + o.quotaSp, 0)
      const totalQuotaAmount = totalQuotaSp * SP_RATE

      // 各開發商（智合 / JV…）獨立小計 —— 預算與消耗分開看，避免合併後失真
      const vendorMap = new Map<string, VendorFinancial>()
      for (const org of orgSummary) {
        for (const v of org.byVendor) {
          const acc = vendorMap.get(v.vendor) ?? {
            vendor: v.vendor, quotaSp: 0, quotaAmount: 0, totalSp: 0, usedSp: 0, amount: 0, usedAmount: 0, demandCount: 0,
          }
          acc.quotaSp += v.quotaSp
          acc.quotaAmount += v.quotaAmount
          acc.totalSp += v.totalSp
          acc.usedSp += v.usedSp
          acc.amount += v.amount
          acc.usedAmount += v.usedAmount
          acc.demandCount += v.demandCount
          vendorMap.set(v.vendor, acc)
        }
      }
      const vendorSummary = Array.from(vendorMap.values()).sort((a, b) => b.quotaSp - a.quotaSp || a.vendor.localeCompare(b.vendor, "zh-TW"))

      // Demand detail (grouped by org) — exclude 已駁回 / 已取消 (不佔用預算)
      const demandDetail = demands
        .filter((d) => d.status !== "REJECTED" && d.status !== "CANCELLED")
        .map((d) => {
          const sp = d.confirmedSp ?? d.estimatedSp ?? 0
          const used = calcUsedSp(d.status, sp, d.heldFromStatus)
          return {
            organization: d.organization.name,
            demandNumber: d.demandNumber,
            title: d.title,
            status: d.status,
            vendor: d.vendor,
            sp,
            usedSp: used,
            amount: sp * SP_RATE,
            usedAmount: used * SP_RATE,
          }
        })

      // Monthly ledger: SP consumption deltas from status transitions
      // Build signoff date lookup: demandId → phase → respondedAt[] (簽核為主)
      const signoffDates = new Map<string, Map<string, Date[]>>()
      for (const s of approvedSignoffs) {
        if (!s.respondedAt) continue
        if (!signoffDates.has(s.demandId)) signoffDates.set(s.demandId, new Map())
        const phaseMap = signoffDates.get(s.demandId)!
        if (!phaseMap.has(s.phase)) phaseMap.set(s.phase, [])
        phaseMap.get(s.phase)!.push(s.respondedAt)
      }
      // Phase signoff → status transition mapping
      const SIGNOFF_PHASE_MAP: Record<string, string> = {
        "SP_REVIEW": "DEVELOPING",    // SP_REVIEW signoff → enters DEVELOPING
        "ACCEPTANCE": "CLOSED",       // ACCEPTANCE signoff → enters CLOSED
        "PRD_REVIEW": "SP_REVIEW",    // PRD_REVIEW signoff → enters SP_REVIEW
      }

      const demandMap = new Map(demands.map((d) => [d.id, {
        demandNumber: d.demandNumber, title: d.title, orgName: d.organization.name,
        vendor: d.vendor, estimatedSp: d.estimatedSp, confirmedSp: d.confirmedSp,
      }]))

      // Collect all transition deltas
      // Group by demand and process chronologically to track effective SP at each point
      const allDeltas: { month: string; org: string; vendor: string; detail: LedgerDetail }[] = []

      const histByDemand = new Map<string, typeof statusHistories>()
      for (const h of statusHistories) {
        if (!demandMap.has(h.demandId)) continue
        if (!histByDemand.has(h.demandId)) histByDemand.set(h.demandId, [])
        histByDemand.get(h.demandId)!.push(h)
      }

      for (const [demandId, histories] of histByDemand) {
        const dem = demandMap.get(demandId)!
        // Sort chronologically (oldest first) to track running SP
        histories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        let runningSp = dem.estimatedSp ?? 0

        for (const h of histories) {
          let spAdj: { type: string; oldSp: number; newSp: number; reason: string } | null = null
          if (h.comment) {
            try {
              const parsed = JSON.parse(h.comment)
              if (parsed?.type === "SP_ADJUSTMENT") spAdj = parsed
            } catch { /* not JSON */ }
          }

          let oldUsed: number, newUsed: number

          // For ON_HOLD / REJECTED transitions, infer heldFromStatus from the other side
          const inferHeld = (s: string | null, other: string | null) =>
            (s === "ON_HOLD" || s === "REJECTED") ? other : null

          if (spAdj) {
            oldUsed = h.fromStatus ? calcUsedSp(h.fromStatus, spAdj.oldSp, inferHeld(h.fromStatus, h.toStatus)) : 0
            newUsed = calcUsedSp(h.toStatus, spAdj.newSp, inferHeld(h.toStatus, h.fromStatus))
            runningSp = spAdj.newSp
          } else {
            oldUsed = h.fromStatus ? calcUsedSp(h.fromStatus, runningSp, inferHeld(h.fromStatus, h.toStatus)) : 0
            newUsed = calcUsedSp(h.toStatus, runningSp, inferHeld(h.toStatus, h.fromStatus))
          }

          const deltaSp = newUsed - oldUsed
          if (deltaSp === 0) continue

          // 簽核為主：find the signoff date for this transition if available
          let effectiveDate = new Date(h.createdAt)
          if (h.fromStatus && !spAdj) {
            // Check if this transition corresponds to a phase signoff
            for (const [phase, targetStatus] of Object.entries(SIGNOFF_PHASE_MAP)) {
              if (h.toStatus === targetStatus && h.fromStatus === phase) {
                const dates = signoffDates.get(h.demandId)?.get(phase)
                if (dates?.length) {
                  // Find the latest signoff respondedAt that is before or close to the status change
                  const hTime = new Date(h.createdAt).getTime()
                  const match = dates
                    .filter((d) => d.getTime() <= hTime + 86400000) // within 1 day
                    .sort((a, b) => b.getTime() - a.getTime())[0]
                  if (match) effectiveDate = match
                }
                break
              }
            }
          }
          const dt = effectiveDate
          const monthKey = `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`

          allDeltas.push({
            month: monthKey,
            org: dem.orgName,
            vendor: dem.vendor,
            detail: {
              demandNumber: dem.demandNumber, title: dem.title,
              vendor: dem.vendor,
              fromStatus: h.fromStatus, toStatus: h.toStatus,
              sp: spAdj ? spAdj.newSp : runningSp,
              deltaSp, deltaAmount: deltaSp * SP_RATE,
              date: effectiveDate.toISOString(),
              ...(spAdj ? { spChange: { from: spAdj.oldSp, to: spAdj.newSp, reason: spAdj.reason || "" } } : {}),
            },
          })
        }
      }

      // Group by month → org, last 12 months
      const monthlyLedgerMap = new Map<string, Map<string, LedgerDetail[]>>()
      for (const d of allDeltas) {
        if (!monthlyLedgerMap.has(d.month)) monthlyLedgerMap.set(d.month, new Map())
        const orgMap = monthlyLedgerMap.get(d.month)!
        if (!orgMap.has(d.org)) orgMap.set(d.org, [])
        orgMap.get(d.org)!.push(d.detail)
      }

      // Generate last 12 months (even if empty)
      const monthlyLedger: MonthlyLedger[] = []
      for (let i = 11; i >= 0; i--) {
        const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        const monthLabel = `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
        const orgMap = monthlyLedgerMap.get(monthLabel)
        const data: MonthlyLedgerOrg[] = []
        if (orgMap) {
          for (const [org, details] of orgMap) {
            const deltaSp = details.reduce((s, d) => s + d.deltaSp, 0)
            const sortedDetails = details
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            data.push({
              organization: org, deltaSp, deltaAmount: deltaSp * SP_RATE,
              details: sortedDetails,
            })
          }
          data.sort((a, b) => b.deltaAmount - a.deltaAmount)
        }
        monthlyLedger.push({ month: monthLabel, data })
      }

      financial = { totalQuotaSp, totalQuotaAmount, vendorSummary, orgSummary, demandDetail, monthlyLedger }
    }

    return NextResponse.json({
      kpi: {
        activeDemands,
        thisMonthClosed,
        ytdUsedSp,
        avgDays,
        avgDaysCount: devsWithDates.length,
        totalDemands: demands.length,
      },
      statusCounts,
      orgDemandCounts,
      devDemandCounts,
      monthlyTrends,
      sp: {
        totalQuota,
        totalUsedSp,
        totalAvailable: totalQuota - totalUsedSp,
        byVendor: spByVendor,
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
      devWorkload: Object.values(devWorkload).map((w) => ({ ...w, usedSp: Math.round(w.usedSp) })).sort((a, b) => b.usedSp - a.usedSp),
      ...(financial ? { financial } : {}),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Governance analytics error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
