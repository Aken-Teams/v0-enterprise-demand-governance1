import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { nanoid } from "nanoid"
import { logAudit } from "@/lib/audit"
import { resolveShareExpiry } from "@/lib/share-expiry"

const SHARE_ROLES = ["admin", "delivery", "subsidiary", "viewer"] as const

/**
 * 這位使用者在「這一張需求」上是不是需求方的人。
 *
 * 全域角色會跟專案身分衝突：例如 Scrum Master 的帳號是 viewer（唯讀、可跨子公司看），
 * 但他同時可能是某幾張需求的需求窗口。在自己那幾張需求上，他就該比照一般需求者，
 * 能簽核、也能分享連結，不該被全域的 viewer 角色擋掉。
 */
async function isDemandRequesterSide(
  userId: string,
  demand: { id: string; submitterId: string; contactPersonId: string | null; demandManagerId: string | null },
): Promise<boolean> {
  if (demand.submitterId === userId) return true
  if (demand.contactPersonId === userId) return true
  if (demand.demandManagerId === userId) return true
  // 被指派到這張需求且不是純觀察者
  const grant = await prisma.demandAccess.findUnique({
    where: { demandId_userId: { demandId: demand.id, userId } },
    select: { signoffRole: true },
  })
  return !!grant && grant.signoffRole !== "OBSERVER"
}

// POST: Create a share link for a demand
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, [...SHARE_ROLES])
    const { id } = await params

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Viewer: 只有在自己是需求方的那幾張需求上才能分享
    if (auth.role === "viewer" && !(await isDemandRequesterSide(auth.userId, demand))) {
      return NextResponse.json({ error: "無權限分享此需求" }, { status: 403 })
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
      if (user?.organizationId !== demand.organizationId && !(await isDemandRequesterSide(auth.userId, demand))) {
        return NextResponse.json({ error: "無權限分享此需求" }, { status: 403 })
      }
    }

    const token = nanoid(12)
    // 有效期：管理者可自訂（天數或到期日），其餘角色一律 7 天
    const body = await request.json().catch(() => ({}))
    const expiresAt = resolveShareExpiry(auth.role, body)

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
    const auth = verifyRole(request, [...SHARE_ROLES])
    const { id } = await params

    if (auth.role === "viewer") {
      const demand = await prisma.demand.findUnique({
        where: { id },
        select: { id: true, submitterId: true, contactPersonId: true, demandManagerId: true },
      })
      if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })
      if (!(await isDemandRequesterSide(auth.userId, demand))) {
        return NextResponse.json({ shares: [] })
      }
    }

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
    const auth = verifyRole(request, [...SHARE_ROLES])
    const { id } = await params

    const { shareId } = await request.json()
    if (!shareId) {
      return NextResponse.json({ error: "缺少 shareId" }, { status: 400 })
    }

    if (auth.role === "viewer") {
      const demand = await prisma.demand.findUnique({
        where: { id },
        select: { id: true, submitterId: true, contactPersonId: true, demandManagerId: true },
      })
      if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })
      if (!(await isDemandRequesterSide(auth.userId, demand))) {
        return NextResponse.json({ error: "無權限撤銷此分享連結" }, { status: 403 })
      }
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
