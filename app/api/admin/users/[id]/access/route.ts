import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const VALID_SIGNOFF_ROLES = ["REQUESTER", "MANAGER", "BOARD", "OBSERVER"] as const

// GET: List a user's demand access + signoff role assignments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    verifyRole(request, ["admin"])
    const { id } = await params

    const grants = await prisma.demandAccess.findMany({
      where: { userId: id },
      include: {
        demand: {
          select: { id: true, demandNumber: true, title: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      // Legacy format for backward compat
      demandIds: grants.map((g) => g.demandId),
      // New format with signoff roles
      assignments: grants.map((g) => ({
        demandId: g.demandId,
        signoffRole: g.signoffRole,
        demand: {
          id: g.demand.id,
          demandNumber: g.demand.demandNumber,
          title: g.demand.title,
          status: g.demand.status,
        },
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("List user access error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PUT: Replace a user's entire demand access + signoff role assignments
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin"])
    const { id } = await params
    const body = await request.json()

    // Support both legacy { demandIds } and new { assignments } format
    type Assignment = { demandId: string; signoffRole?: string }
    let assignments: Assignment[] = []

    if (Array.isArray(body.assignments)) {
      assignments = body.assignments
    } else if (Array.isArray(body.demandIds)) {
      // Legacy: convert demandIds to assignments with OBSERVER default
      assignments = body.demandIds.map((demandId: string) => ({
        demandId,
        signoffRole: "OBSERVER",
      }))
    }

    // Validate signoff roles
    for (const a of assignments) {
      const role = a.signoffRole || "OBSERVER"
      if (!VALID_SIGNOFF_ROLES.includes(role as typeof VALID_SIGNOFF_ROLES[number])) {
        return NextResponse.json(
          { error: `不合法的審核角色: ${role}` },
          { status: 400 },
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      // Clear existing grants
      await tx.demandAccess.deleteMany({ where: { userId: id } })

      // Create new grants (if any)
      if (assignments.length > 0) {
        await tx.demandAccess.createMany({
          data: assignments.map((a) => ({
            demandId: a.demandId,
            userId: id,
            grantedBy: auth.userId,
            signoffRole: (a.signoffRole || "OBSERVER") as "REQUESTER" | "MANAGER" | "BOARD" | "OBSERVER",
          })),
        })
      }
    })

    // Resolve demand numbers for audit log
    const demandIds = assignments.map((a) => a.demandId)
    const grantedDemands = demandIds.length > 0
      ? await prisma.demand.findMany({
          where: { id: { in: demandIds } },
          select: { demandNumber: true, title: true },
        })
      : []

    logAudit({
      userId: auth.userId,
      action: "GRANT",
      entity: "ACCESS",
      entityId: id,
      details: {
        demands: grantedDemands.map((d) => `${d.demandNumber} ${d.title}`),
        roles: assignments.map((a) => `${a.demandId}:${a.signoffRole || "OBSERVER"}`),
      },
      request,
    })

    return NextResponse.json({ success: true, count: assignments.length })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update user access error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
