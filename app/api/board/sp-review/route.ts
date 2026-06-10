import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

/**
 * GET /api/board/sp-review
 * Returns pending SP_REVIEW signoffs AND BOARD_OVERRIDE signoffs for the current board member.
 * ?countOnly=true  → { count } (lightweight, for nav badge)
 * Otherwise        → { count, items: [{ signoff, demand }] }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { isBoardMember: true, restrictBoardToOrg: true, organizationId: true },
    })

    if (!user?.isBoardMember) {
      return NextResponse.json({ error: "非董事會成員" }, { status: 403 })
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

    if (countOnly) {
      const count = await prisma.phaseSignoff.count({ where: whereClause })
      return NextResponse.json({ count })
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

    return NextResponse.json({ count: items.length, items })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Board SP review error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
