import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// GET: List a user's demand access whitelist
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
      demandIds: grants.map((g) => g.demandId),
      demands: grants.map((g) => ({
        id: g.demand.id,
        demandNumber: g.demand.demandNumber,
        title: g.demand.title,
        status: g.demand.status,
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

// PUT: Replace a user's entire demand access whitelist
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin"])
    const { id } = await params
    const body = await request.json()
    const demandIds: string[] = body.demandIds ?? []

    await prisma.$transaction(async (tx) => {
      // Clear existing grants
      await tx.demandAccess.deleteMany({ where: { userId: id } })

      // Create new grants (if any)
      if (demandIds.length > 0) {
        await tx.demandAccess.createMany({
          data: demandIds.map((demandId) => ({
            demandId,
            userId: id,
            grantedBy: auth.userId,
          })),
        })
      }
    })

    // Resolve demand numbers for audit log
    const demands = demandIds.length > 0
      ? await prisma.demand.findMany({
          where: { id: { in: demandIds } },
          select: { demandNumber: true, title: true },
        })
      : []
    const demandList = demands.map((d) => `${d.demandNumber}（${d.title}）`)

    logAudit({
      userId: auth.userId,
      action: "GRANT",
      entity: "ACCESS",
      entityId: id,
      details: { demands: demandList.join("、") || "無", count: demandIds.length },
      request,
    })

    return NextResponse.json({ success: true, count: demandIds.length })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update user access error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
