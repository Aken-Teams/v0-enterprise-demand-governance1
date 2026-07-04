import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { DESIGN_CHANGE_ALLOWED_PHASES, STATUS_MAP } from "@/lib/constants/demand"
import { parseChecklistMarkdown, resolveDesignChangeReviewers } from "@/lib/design-change"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/markdown", "text/plain", "image/jpeg", "image/png", "image/gif", "image/webp", "application/octet-stream",
])
const ALLOWED_EXTENSIONS = new Set(["md", "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "gif", "webp"])
const MAX_FILE_SIZE = 10 * 1024 * 1024

// POST: 對既有設計變更提出新版本（駁回後修訂）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, dcId } = await params

    const formData = await request.formData()
    const summary = (formData.get("summary") as string | null)?.trim()
    const checklistMd = (formData.get("checklistMd") as string | null) ?? null
    const affectsSp = formData.get("affectsSp") === "true"
    const spNote = (formData.get("spNote") as string | null)?.trim() || null
    const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0)

    if (!summary) return NextResponse.json({ error: "請填寫變更摘要說明" }, { status: 400 })
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `檔案「${file.name}」超過 10MB 限制` }, { status: 400 })
      if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: `檔案「${file.name}」格式不支援` }, { status: 400 })
      if (file.type === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALLOWED_EXTENSIONS.has(ext)) return NextResponse.json({ error: `檔案「${file.name}」格式不支援 (.${ext})` }, { status: 400 })
      }
    }

    const dc = await prisma.designChange.findUnique({
      where: { id: dcId },
      include: {
        demand: { select: { id: true, demandNumber: true, title: true, status: true, organizationId: true, contactPersonId: true, demandManagerId: true, estimatedSp: true, confirmedSp: true } },
        revisions: { orderBy: { version: "desc" }, take: 1 },
      },
    })
    if (!dc || dc.demandId !== id) return NextResponse.json({ error: "設計變更不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id: dc.demand.id, organizationId: dc.demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }
    if (!DESIGN_CHANGE_ALLOWED_PHASES.includes(dc.demand.status as typeof DESIGN_CHANGE_ALLOWED_PHASES[number])) {
      return NextResponse.json({ error: "目前階段無法修訂設計變更" }, { status: 400 })
    }

    const latest = dc.revisions[0]
    if (latest && latest.status === "PENDING") {
      return NextResponse.json({ error: "目前版本尚待審核，無法再提新版本" }, { status: 409 })
    }
    if (dc.status === "APPROVED") {
      return NextResponse.json({ error: "此設計變更已通過，無需再修訂" }, { status: 400 })
    }

    const reviewers = resolveDesignChangeReviewers(dc.demand)
    const checklistItems = parseChecklistMarkdown(checklistMd)
    const nextVersion = (latest?.version ?? 0) + 1
    const spCurrent = affectsSp ? (dc.demand.confirmedSp ?? dc.demand.estimatedSp) : null
    const spDeltaRaw = Number(formData.get("spDelta"))
    const spDelta = affectsSp && Number.isFinite(spDeltaRaw) ? spDeltaRaw : null
    if (spCurrent != null && spDelta != null && spCurrent + spDelta < 0) {
      return NextResponse.json({ error: "SP 下降不可超過目前 SP（調整後不可為負）" }, { status: 400 })
    }

    const rev = await prisma.$transaction(async (tx) => {
      const r = await tx.designChangeRevision.create({
        data: {
          designChangeId: dc.id, version: nextVersion, summary, checklistMd, affectsSp, spCurrent, spDelta, spNote,
          status: "PENDING", submittedById: auth.userId,
        },
      })
      if (checklistItems.length > 0) {
        await tx.designChangeChecklistItem.createMany({
          data: checklistItems.map((it, i) => ({ revisionId: r.id, orderIndex: i, text: it.text, devChecked: it.checked })),
        })
      }
      if (reviewers.length > 0) {
        await tx.designChangeReview.createMany({
          data: reviewers.map((rv) => ({ revisionId: r.id, reviewerId: rv.userId, role: rv.role, decision: "PENDING" as const })),
        })
      }
      await tx.designChange.update({
        where: { id: dc.id }, data: { currentVersion: nextVersion, status: "PENDING" },
      })
      return r
    })

    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
        await writeFile(path.join(uploadDir, safeFileName), buffer)
        await prisma.designChangeDocument.create({
          data: { revisionId: rev.id, fileName: file.name, fileUrl: `/api/uploads/demands/${id}/${safeFileName}`, fileSize: file.size, uploadedById: auth.userId },
        })
      }
    }

    const phaseLabel = STATUS_MAP[dc.demand.status]?.label ?? dc.demand.status
    const recipients = [...new Set(reviewers.map((r) => r.userId).filter((uid) => uid !== auth.userId))]
    if (recipients.length > 0) {
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: "設計變更已更新，待重新確認",
        message: `需求 ${dc.demand.demandNumber}「${dc.demand.title}」的設計變更「${dc.title}」已更新為 v${nextVersion}（${phaseLabel}），請重新確認。`,
        linkUrl: `/demands/${id}`,
      })
    }
    logAudit({
      userId: auth.userId, action: "SIGNOFF_REQUEST", entity: "SIGNOFF", entityId: dc.id, demandId: id,
      details: { kind: "DESIGN_CHANGE_REVISION", seq: dc.seq, version: nextVersion, affectsSp },
      request,
    })

    return NextResponse.json({ revision: { id: rev.id, version: nextVersion } }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Create design change revision error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
