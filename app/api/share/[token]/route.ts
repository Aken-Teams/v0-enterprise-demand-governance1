import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isDevDeliveryLink, shouldMaskDevLinks } from "@/lib/dev-link"

// GET: Public demand view via share token (no JWT required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const share = await prisma.demandShare.findUnique({
      where: { token },
    })

    if (!share) {
      return NextResponse.json({ error: "分享連結不存在" }, { status: 404 })
    }

    if (share.expiresAt < new Date()) {
      return NextResponse.json({ error: "分享連結已過期" }, { status: 410 })
    }

    const demand = await prisma.demand.findUnique({
      where: { id: share.demandId },
      include: {
        organization: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
        contactPerson_: { select: { id: true, name: true } },
        demandManager: { select: { id: true, name: true } },
        documents: {
          orderBy: { createdAt: "desc" },
          include: { designChange: { select: { id: true, seq: true, title: true } } },
        },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        phasePlans: {
          include: {
            engineer: { select: { id: true, name: true } },
            pm: { select: { id: true, name: true } },
          },
        },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { order: "asc" },
        },
        phaseSignoffs: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            respondedBy: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true } },
            documents: { select: { id: true, fileName: true, fileUrl: true, fileSize: true } },
          },
          orderBy: { requestedAt: "desc" },
        },
        designChanges: { select: { id: true, seq: true, title: true, status: true } },
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const maskDevLinks = shouldMaskDevLinks(demand)

    // Sanitize: remove confidential fields and restructure contactPerson_
    const { contactPerson_: contactPersonUser, ...demandFields } = demand as typeof demand & { contactPerson_: { id: string; name: string } | null }
    const sanitized = {
      ...demandFields,
      contactPerson: contactPersonUser,
      adminNotes: null,
      rejectReason: null,
      // 智合抽成/報價單為內部機密，分享頁一律隱藏
      zhiheSpTaken: null,
      zhiheSpNote: null,
      quoteReviewedById: null,
      quoteReviewedAt: null,
      // Filter out internal comments
      comments: demand.comments.filter((c) => !c.isInternal),
      // Filter out GITHUB_REPO + 報價單 documents
      // 開發中的 APP 交付連結須由需求方登入確認後才開放（確認即認列 25%），
      // 匿名檢視一律看不到；登入後改走 /api/demands/[id]，由該處依身分判斷。
      documents: demand.documents.filter(
        (d) => d.type !== "GITHUB_REPO" && d.type !== "ZHIHE_QUOTE" && !(maskDevLinks && isDevDeliveryLink(d))
      ),
      devLinkMasked: maskDevLinks,
    }

    return NextResponse.json({
      demand: sanitized,
      demandId: demand.id,
      expiresAt: share.expiresAt,
    })
  } catch (error) {
    console.error("Share view error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
