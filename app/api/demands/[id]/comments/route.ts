import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { notifyUsers, getDemandStakeholderIds, getOrgSubsidiaryUserIds, getAdminUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)
    if (auth.role === "viewer") {
      return NextResponse.json({ error: "唯讀帳號無法留言" }, { status: 403 })
    }
    const { id } = await params
    const { content, isInternal } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "留言內容不能為空" }, { status: 400 })
    }

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, demandNumber: true, title: true, organizationId: true },
    })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Admin write permission check (view-only admins cannot comment)
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id, organizationId: demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    const comment = await prisma.demandComment.create({
      data: {
        demandId: id,
        userId: auth.userId,
        content: content.trim(),
      },
      include: { user: { select: { id: true, name: true } } },
    })

    // Fire-and-forget: notification + audit
    if (isInternal) {
      // Internal comment: only notify admin/delivery users (stakeholders minus org subsidiary)
      getDemandStakeholderIds(id).then((sIds) => {
        const recipients = sIds.filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "COMMENT",
          title: "新內部留言",
          message: `需求 ${demand.demandNumber}「${demand.title}」有新的內部留言。`,
          linkUrl: `/demands/${id}`,
        })
      })
    } else {
      const stakeholderIds = getDemandStakeholderIds(id)
      const orgUserIds = getOrgSubsidiaryUserIds(demand.organizationId)
      Promise.all([stakeholderIds, orgUserIds]).then(([sIds, oIds]) => {
        const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "COMMENT",
          title: "新留言",
          message: `需求 ${demand.demandNumber}「${demand.title}」有新的留言。`,
          linkUrl: `/demands/${id}`,
        })
      })
    }
    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "COMMENT",
      entityId: comment.id,
      demandId: id,
      details: { isInternal: !!isInternal },
      request,
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Add comment error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
