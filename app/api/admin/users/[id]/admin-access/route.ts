import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"

/**
 * GET /api/admin/users/[id]/admin-access
 * Returns the AdminAccess entries for a given admin user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    verifyRole(request, ["admin"])
    const { id } = await params

    const entries = await prisma.adminAccess.findMany({
      where: { userId: id },
      include: {
        organization: { select: { id: true, name: true } },
        demand: { select: { id: true, title: true, number: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ entries })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin access GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

/**
 * PUT /api/admin/users/[id]/admin-access
 * Replace all AdminAccess entries for a user.
 * Body: { scopeType: "all"|"organization"|"project", entries: [{ organizationId?, demandId?, permission }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)
    const { id } = await params
    const { scopeType, entries } = await request.json()

    if (!["all", "organization", "project"].includes(scopeType)) {
      return NextResponse.json({ error: "無效的範圍類型" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Update scopeType on user
      await tx.user.update({
        where: { id },
        data: { adminScopeType: scopeType },
      })

      // Clear existing AdminAccess entries
      await tx.adminAccess.deleteMany({ where: { userId: id } })

      // Create new entries (only for non-"all" scope)
      if (scopeType !== "all" && Array.isArray(entries) && entries.length > 0) {
        const data = entries.map((e: { organizationId?: string; demandId?: string; permission?: string }) => ({
          userId: id,
          organizationId: scopeType === "organization" ? (e.organizationId || null) : null,
          demandId: scopeType === "project" ? (e.demandId || null) : null,
          permission: e.permission || "view",
          grantedBy: auth.userId,
        }))
        await tx.adminAccess.createMany({ data })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin access PUT error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
