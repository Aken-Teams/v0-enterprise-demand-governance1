import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

// GET: Get pending sign-off count and demand list for current user
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    // Build filter based on role
    let demandFilter: Record<string, unknown> = {}

    if (auth.role === "subsidiary") {
      // Check if user has restricted access (DemandAccess whitelist)
      const [user, accessGrants] = await Promise.all([
        prisma.user.findUnique({
          where: { id: auth.userId },
          select: { organizationId: true },
        }),
        prisma.demandAccess.findMany({
          where: { userId: auth.userId },
          select: { demandId: true },
        }),
      ])
      if (accessGrants.length > 0) {
        // Restricted user: only see signoffs for whitelisted demands
        demandFilter = { id: { in: accessGrants.map((g) => g.demandId) } }
      } else {
        // Normal subsidiary: sees signoffs for demands in their org
        demandFilter = user?.organizationId
          ? { organizationId: user.organizationId }
          : { submitterId: auth.userId }
      }
    } else if (auth.role === "admin") {
      // Admin sees all
      demandFilter = {}
    } else {
      // Delivery sees signoffs for demands they develop
      demandFilter = { developerId: auth.userId }
    }

    const pendingSignoffs = await prisma.phaseSignoff.findMany({
      where: {
        status: "PENDING",
        demand: demandFilter,
      },
      include: {
        demand: {
          select: { id: true, demandNumber: true, title: true },
        },
      },
      orderBy: { requestedAt: "desc" },
    })

    const demands = pendingSignoffs.map((s) => ({
      id: s.demand.id,
      demandNumber: s.demand.demandNumber,
      title: s.demand.title,
      phase: s.phase,
      signoffId: s.id,
    }))

    return NextResponse.json({
      count: demands.length,
      demands,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get pending signoffs error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
