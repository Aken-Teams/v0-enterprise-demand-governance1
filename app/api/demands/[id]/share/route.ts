import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { nanoid } from "nanoid"
import { logAudit } from "@/lib/audit"

// POST: Create a share link for a demand
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery", "subsidiary"])
    const { id } = await params

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Admin write permission check
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id, organizationId: demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    // Subsidiary: verify user belongs to the demand's organization
    if (auth.role === "subsidiary") {
      const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { organizationId: true } })
      if (user?.organizationId !== demand.organizationId) {
        return NextResponse.json({ error: "無權限分享此需求" }, { status: 403 })
      }
    }

    const token = nanoid(12)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +7 days

    const share = await prisma.demandShare.create({
      data: {
        demandId: id,
        token,
        createdById: auth.userId,
        expiresAt,
      },
    })

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "SHARE",
      entityId: share.id,
      demandId: id,
      details: { token: share.token, expiresAt: share.expiresAt },
      request,
    })

    return NextResponse.json({
      id: share.id,
      token: share.token,
      url: `/share/${share.token}`,
      expiresAt: share.expiresAt,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Create share link error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// GET: List share links for a demand
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    verifyRole(request, ["admin", "delivery", "subsidiary"])
    const { id } = await params

    const shares = await prisma.demandShare.findMany({
      where: { demandId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ shares })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("List share links error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: Revoke a share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery", "subsidiary"])
    const { id } = await params

    const { shareId } = await request.json()
    if (!shareId) {
      return NextResponse.json({ error: "缺少 shareId" }, { status: 400 })
    }

    await prisma.demandShare.delete({ where: { id: shareId } })

    logAudit({
      userId: auth.userId,
      action: "DELETE",
      entity: "SHARE",
      entityId: shareId,
      demandId: id,
      details: { shareId },
      request,
    })

    return NextResponse.json({ message: "分享連結已撤銷" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete share link error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
