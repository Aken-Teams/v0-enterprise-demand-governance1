import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Sanitize: remove confidential fields and restructure contactPerson_
    const { contactPerson_: contactPersonUser, ...demandFields } = demand as typeof demand & { contactPerson_: { id: string; name: string } | null }
    const sanitized = {
      ...demandFields,
      contactPerson: contactPersonUser,
      adminNotes: null,
      rejectReason: null,
      // Filter out internal comments
      comments: demand.comments.filter((c) => !c.isInternal),
      // Filter out GITHUB_REPO documents
      documents: demand.documents.filter((d) => d.type !== "GITHUB_REPO"),
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
