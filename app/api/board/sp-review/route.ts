import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { parseClosingSpPayload } from "@/lib/closing-sp"

/**
 * GET /api/board/sp-review
 * Returns everything awaiting this board member:
 *  - items        : 開案審核 (SP_REVIEW) 與 Scrum Master 代簽
 *  - designChanges: 設計變更（設計變更確認）——不論是否影響 SP，Scrum Master 皆須背書
 *  - closingSp    : 結案 SP 調整（kind = CLOSING_SP）
 * ?countOnly=true  → { count } (lightweight, for nav badge)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { isBoardMember: true, restrictBoardToOrg: true, organizationId: true },
    })

    if (!user?.isBoardMember) {
      return NextResponse.json({ error: "非 Scrum Master" }, { status: 403 })
    }

    // Org-restricted board members only see their own org's demands
    const orgDemandFilter: Record<string, unknown> = {}
    if (user.restrictBoardToOrg && user.organizationId) {
      orgDemandFilter.organizationId = user.organizationId
    }

    const countOnly = request.nextUrl.searchParams.get("countOnly") === "true"

    // Match both regular SP_REVIEW signoffs AND BOARD_OVERRIDE signoffs (any phase)
    const whereClause = {
      status: "PENDING" as const,
      targetUserId: auth.userId,
      OR: [
        { phase: "SP_REVIEW" as const, demand: { status: "SP_REVIEW", ...orgDemandFilter } },
        { targetRole: "BOARD_OVERRIDE", demand: orgDemandFilter },
      ],
    }

    // 設計變更：本 Scrum Master 有待審(PENDING)的 BOARD 裁決且為最新版本。
    // 新流程改為「設計變更確認」——不論是否影響 SP，Scrum Master 都必須背書，故不再以 affectsSp 過濾。
    const dcBoardReviews = await prisma.designChangeReview.findMany({
      where: { reviewerId: auth.userId, role: "BOARD", decision: "PENDING", revision: { status: "PENDING" } },
      include: {
        revision: {
          select: {
            id: true, version: true, affectsSp: true, spCurrent: true, spDelta: true, spNote: true, summary: true,
            designChange: {
              select: {
                id: true, seq: true, title: true, currentVersion: true,
                demand: { select: { id: true, demandNumber: true, title: true, organization: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    })
    const designChanges = dcBoardReviews
      .filter((r) => r.revision.version === r.revision.designChange.currentVersion)
      .filter((r) => !user.restrictBoardToOrg || !user.organizationId || r.revision.designChange.demand.organization?.id === user.organizationId)
      .map((r) => ({
        reviewId: r.id,
        revisionId: r.revision.id,
        dcId: r.revision.designChange.id,
        seq: r.revision.designChange.seq,
        dcTitle: r.revision.designChange.title,
        version: r.revision.version,
        stage: r.stage,
        affectsSp: r.revision.affectsSp,
        spCurrent: r.revision.spCurrent,
        spDelta: r.revision.spDelta,
        spNote: r.revision.spNote,
        summary: r.revision.summary,
        demand: r.revision.designChange.demand,
      }))

    // 結案 SP 調整：待本 Scrum Master 簽核者（phase=CLOSED、targetRole=BOARD，不會與上方 whereClause 重疊）
    const closingSignoffs = await prisma.phaseSignoff.findMany({
      where: {
        status: "PENDING", kind: "CLOSING_SP", targetUserId: auth.userId, demand: orgDemandFilter,
      },
      include: {
        demand: {
          select: {
            id: true, demandNumber: true, title: true, status: true,
            estimatedSp: true, confirmedSp: true,
            organization: { select: { id: true, name: true } },
          },
        },
        requestedBy: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: "desc" },
    })

    // 一次撈齊所有被勾選的設計變更，避免逐筆查詢
    const allDcIds = [
      ...new Set(
        closingSignoffs.flatMap((s) => parseClosingSpPayload(s.payload)?.designChangeIds ?? [])
      ),
    ]
    const dcMap = new Map<string, { id: string; seq: number; title: string }>()
    if (allDcIds.length > 0) {
      const dcs = await prisma.designChange.findMany({
        where: { id: { in: allDcIds } },
        select: { id: true, seq: true, title: true },
      })
      for (const d of dcs) dcMap.set(d.id, d)
    }

    const closingSp = closingSignoffs.map((s) => {
      const payload = parseClosingSpPayload(s.payload)
      return {
        signoffId: s.id,
        requestedAt: s.requestedAt,
        requestedBy: s.requestedBy,
        oldSp: payload?.oldSp ?? (s.demand.confirmedSp ?? s.demand.estimatedSp),
        newSp: payload?.newSp ?? null,
        reason: payload?.reason ?? null,
        designChanges: (payload?.designChangeIds ?? [])
          .map((did) => dcMap.get(did))
          .filter((d): d is { id: string; seq: number; title: string } => !!d),
        demand: {
          id: s.demand.id,
          demandNumber: s.demand.demandNumber,
          title: s.demand.title,
          status: s.demand.status,
          organization: s.demand.organization,
        },
      }
    })

    if (countOnly) {
      const count = await prisma.phaseSignoff.count({ where: whereClause })
      return NextResponse.json({ count: count + designChanges.length + closingSp.length })
    }

    const pendingSignoffs = await prisma.phaseSignoff.findMany({
      where: whereClause,
      include: {
        demand: {
          select: {
            id: true,
            demandNumber: true,
            title: true,
            status: true,
            estimatedSp: true,
            confirmedSp: true,
            organization: { select: { id: true, name: true } },
            submitter: { select: { id: true, name: true } },
            contactPerson_: { select: { id: true, name: true } },
            developer: { select: { id: true, name: true } },
          },
        },
        requestedBy: { select: { id: true, name: true } },
        documents: { select: { id: true, fileName: true, fileUrl: true, fileSize: true } },
      },
      orderBy: { requestedAt: "desc" },
    })

    const items = pendingSignoffs.map((s) => ({
      signoff: {
        id: s.id,
        phase: s.phase,
        status: s.status,
        targetRole: s.targetRole,
        requestComment: s.requestComment,
        overrideTargetStatus: s.overrideTargetStatus,
        requestedAt: s.requestedAt,
        requestedBy: s.requestedBy,
        documents: s.documents,
      },
      demand: {
        id: s.demand.id,
        demandNumber: s.demand.demandNumber,
        title: s.demand.title,
        status: s.demand.status,
        estimatedSp: s.demand.estimatedSp,
        confirmedSp: s.demand.confirmedSp,
        organization: s.demand.organization,
        submitter: s.demand.submitter,
        contactPerson: s.demand.contactPerson_,
        developer: s.demand.developer,
      },
    }))

    return NextResponse.json({
      count: items.length + designChanges.length + closingSp.length,
      items, designChanges, closingSp,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Board SP review error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
