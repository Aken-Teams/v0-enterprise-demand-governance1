import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { canAccessDemand, canAdminWrite } from "@/lib/demand-access"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { DESIGN_CHANGE_ALLOWED_PHASES, STATUS_MAP } from "@/lib/constants/demand"
import { parseChecklistMarkdown, resolveDesignChangeReviewers } from "@/lib/design-change"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/markdown", "text/plain",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/octet-stream",
])
const ALLOWED_EXTENSIONS = new Set([
  "md", "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp",
])
const MAX_FILE_SIZE = 10 * 1024 * 1024

const revisionInclude = {
  submittedBy: { select: { id: true, name: true } },
  items: {
    orderBy: { orderIndex: "asc" as const },
    include: {
      feedback: { include: { reviewer: { select: { id: true, name: true } } } },
    },
  },
  reviews: {
    include: { reviewer: { select: { id: true, name: true } } },
    orderBy: { role: "asc" as const },
  },
  documents: {
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
}

// GET: 列出此需求所有設計變更（含版本、逐條、審核、附件）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id } = await params

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, organizationId: true, developerId: true, status: true },
    })
    if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })

    const canView = await canAccessDemand(auth, demand)
    if (!canView) return NextResponse.json({ error: "無權限查看此需求" }, { status: 403 })

    const designChanges = await prisma.designChange.findMany({
      where: { demandId: id },
      orderBy: { seq: "asc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        revisions: { orderBy: { version: "asc" }, include: revisionInclude },
      },
    })

    return NextResponse.json({
      designChanges,
      canPropose: DESIGN_CHANGE_ALLOWED_PHASES.includes(demand.status as typeof DESIGN_CHANGE_ALLOWED_PHASES[number]),
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("List design changes error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: 提出新的設計變更（建立 v1）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    const formData = await request.formData()
    const title = (formData.get("title") as string | null)?.trim()
    const summary = (formData.get("summary") as string | null)?.trim()
    const checklistMd = (formData.get("checklistMd") as string | null) ?? null
    const affectsSp = formData.get("affectsSp") === "true"
    const spNote = (formData.get("spNote") as string | null)?.trim() || null
    const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0)

    if (!title) return NextResponse.json({ error: "請填寫變更標題" }, { status: 400 })
    if (!summary) return NextResponse.json({ error: "請填寫變更摘要說明" }, { status: 400 })

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `檔案「${file.name}」超過 10MB 限制` }, { status: 400 })
      if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: `檔案「${file.name}」格式不支援` }, { status: 400 })
      if (file.type === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALLOWED_EXTENSIONS.has(ext)) return NextResponse.json({ error: `檔案「${file.name}」格式不支援 (.${ext})` }, { status: 400 })
      }
    }

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true, demandNumber: true, title: true, status: true, organizationId: true,
        contactPersonId: true, demandManagerId: true, estimatedSp: true, confirmedSp: true,
      },
    })
    if (!demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id: demand.id, organizationId: demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }

    if (!DESIGN_CHANGE_ALLOWED_PHASES.includes(demand.status as typeof DESIGN_CHANGE_ALLOWED_PHASES[number])) {
      return NextResponse.json({ error: "設計變更僅能於 MVP / 開案 / 開發中 / 驗收 階段提出" }, { status: 400 })
    }
    if (!demand.contactPersonId) {
      return NextResponse.json({ error: "請先指派需求窗口" }, { status: 400 })
    }

    const reviewers = resolveDesignChangeReviewers(demand)
    const checklistItems = parseChecklistMarkdown(checklistMd)
    // SP 影響：現值快照（伺服器端），增減量由前端提供（正=上調，負=下降）
    const spCurrent = affectsSp ? (demand.confirmedSp ?? demand.estimatedSp) : null
    const spDeltaRaw = Number(formData.get("spDelta"))
    const spDelta = affectsSp && Number.isFinite(spDeltaRaw) ? spDeltaRaw : null
    if (spCurrent != null && spDelta != null && spCurrent + spDelta < 0) {
      return NextResponse.json({ error: "SP 下降不可超過目前 SP（調整後不可為負）" }, { status: 400 })
    }

    // 需求內序號
    const last = await prisma.designChange.findFirst({
      where: { demandId: id }, orderBy: { seq: "desc" }, select: { seq: true },
    })
    const seq = (last?.seq ?? 0) + 1

    const created = await prisma.$transaction(async (tx) => {
      const dc = await tx.designChange.create({
        data: {
          demandId: id, seq, title, phase: demand.status as DemandStatus,
          status: "PENDING", currentVersion: 1, createdById: auth.userId,
        },
      })
      const rev = await tx.designChangeRevision.create({
        data: {
          designChangeId: dc.id, version: 1, summary, checklistMd, affectsSp, spCurrent, spDelta, spNote,
          status: "PENDING", submittedById: auth.userId,
        },
      })
      if (checklistItems.length > 0) {
        await tx.designChangeChecklistItem.createMany({
          data: checklistItems.map((it, i) => ({ revisionId: rev.id, orderIndex: i, text: it.text, devChecked: it.checked })),
        })
      }
      if (reviewers.length > 0) {
        await tx.designChangeReview.createMany({
          data: reviewers.map((r) => ({ revisionId: rev.id, reviewerId: r.userId, role: r.role, decision: "PENDING" as const })),
        })
      }
      return { dc, rev }
    })

    // 附件
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
        await writeFile(path.join(uploadDir, safeFileName), buffer)
        await prisma.designChangeDocument.create({
          data: {
            revisionId: created.rev.id, fileName: file.name,
            fileUrl: `/api/uploads/demands/${id}/${safeFileName}`, fileSize: file.size,
            uploadedById: auth.userId,
          },
        })
      }
    }

    // 通知審核人 + audit
    const phaseLabel = STATUS_MAP[demand.status]?.label ?? demand.status
    const recipients = reviewers.map((r) => r.userId).filter((uid) => uid !== auth.userId)
    if (recipients.length > 0) {
      notifyUsers([...new Set(recipients)], {
        type: "SIGNOFF",
        title: "設計變更待確認",
        message: `需求 ${demand.demandNumber}「${demand.title}」在「${phaseLabel}」提出設計變更「${title}」，請您逐項確認。`,
        linkUrl: `/demands/${id}`,
      })
    }
    logAudit({
      userId: auth.userId, action: "SIGNOFF_REQUEST", entity: "SIGNOFF",
      entityId: created.dc.id, demandId: id,
      details: { kind: "DESIGN_CHANGE_V2", seq, title, affectsSp, phase: demand.status },
      request,
    })

    return NextResponse.json({ designChange: { id: created.dc.id, seq } }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Create design change error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
