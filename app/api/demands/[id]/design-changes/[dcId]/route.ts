import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { parseChecklistMarkdown, resolveDesignChangeReviewers } from "@/lib/design-change"
import { STATUS_MAP } from "@/lib/constants/demand"
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

// DELETE: 永久刪除整筆設計變更（含所有版本、審核、檔案紀錄）
// 供管理者移除填寫錯誤或誤建立的設計變更。
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, dcId } = await params

    const dc = await prisma.designChange.findUnique({
      where: { id: dcId },
      select: { id: true, demandId: true, seq: true, title: true, status: true, demand: { select: { organizationId: true } } },
    })
    if (!dc || dc.demandId !== id) return NextResponse.json({ error: "設計變更不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id, organizationId: dc.demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }

    // 級聯刪除：revisions → items/feedback/reviews/documents（schema onDelete: Cascade）；
    // 需求文件的關聯 (DemandDocument.designChangeId) 會被設為 null。
    await prisma.designChange.delete({ where: { id: dcId } })

    logAudit({
      userId: auth.userId, action: "DELETE", entity: "SIGNOFF", entityId: dcId, demandId: id,
      details: { kind: "DESIGN_CHANGE_DELETE", seq: dc.seq, title: dc.title, prevStatus: dc.status },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Delete design change error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PATCH: 原地編輯「待確認」設計變更的目前版本（標題／摘要／checklist／SP／需求窗口）。
// 內容變更後會重建逐條項目、重置審核為待確認並重新通知（不新增版本號）。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, dcId } = await params

    const formData = await request.formData()
    const title = (formData.get("title") as string | null)?.trim()
    const summary = (formData.get("summary") as string | null)?.trim()
    const checklistMd = (formData.get("checklistMd") as string | null) ?? null
    const affectsSp = formData.get("affectsSp") === "true"
    const spNote = (formData.get("spNote") as string | null)?.trim() || null
    const contactPersonOverride = (formData.get("contactPersonId") as string | null)?.trim() || null
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

    const dc = await prisma.designChange.findUnique({
      where: { id: dcId },
      include: {
        demand: { select: { id: true, demandNumber: true, title: true, status: true, organizationId: true, contactPersonId: true, demandManagerId: true, estimatedSp: true, confirmedSp: true } },
        revisions: { orderBy: { version: "desc" }, take: 1, select: { id: true, status: true } },
      },
    })
    if (!dc || dc.demandId !== id) return NextResponse.json({ error: "設計變更不存在" }, { status: 404 })
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id: dc.demand.id, organizationId: dc.demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }
    if (dc.status !== "PENDING") {
      return NextResponse.json({ error: "僅「待確認」的設計變更可編輯（已通過／駁回請用重新送出，或先撤銷）" }, { status: 400 })
    }
    const latest = dc.revisions[0]
    if (!latest || latest.status !== "PENDING") {
      return NextResponse.json({ error: "目前版本非待確認狀態，無法編輯" }, { status: 400 })
    }

    // 需求窗口：預設沿用專案設定，可手動指定（須為對此需求有存取權的使用者）
    let finalContactPersonId = dc.demand.contactPersonId
    if (contactPersonOverride) {
      const eligible = await prisma.demandAccess.findFirst({ where: { demandId: id, userId: contactPersonOverride }, select: { userId: true } })
      if (!eligible) return NextResponse.json({ error: "指定的需求窗口無效（須為對此需求有存取權的使用者）" }, { status: 400 })
      finalContactPersonId = contactPersonOverride
    }
    if (!finalContactPersonId) return NextResponse.json({ error: "請先指派需求窗口" }, { status: 400 })

    const reviewers = resolveDesignChangeReviewers(dc.demand, { contactPersonOverride: finalContactPersonId })
    const checklistItems = parseChecklistMarkdown(checklistMd)
    const spCurrent = affectsSp ? (dc.demand.confirmedSp ?? dc.demand.estimatedSp) : null
    const spDeltaRaw = Number(formData.get("spDelta"))
    const spDelta = affectsSp && Number.isFinite(spDeltaRaw) ? spDeltaRaw : null
    if (spCurrent != null && spDelta != null && spCurrent + spDelta < 0) {
      return NextResponse.json({ error: "SP 下降不可超過目前 SP（調整後不可為負）" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.designChange.update({ where: { id: dcId }, data: { title, status: "PENDING" } })
      await tx.designChangeRevision.update({
        where: { id: latest.id },
        data: { summary, checklistMd, affectsSp, spCurrent, spDelta, spNote, status: "PENDING", decidedAt: null },
      })
      // 內容已變 → 重建逐條項目（連帶清掉舊回饋）並重置審核
      await tx.designChangeChecklistItem.deleteMany({ where: { revisionId: latest.id } })
      if (checklistItems.length > 0) {
        await tx.designChangeChecklistItem.createMany({
          data: checklistItems.map((it, i) => ({ revisionId: latest.id, orderIndex: i, text: it.text, devChecked: it.checked })),
        })
      }
      await tx.designChangeReview.deleteMany({ where: { revisionId: latest.id } })
      if (reviewers.length > 0) {
        await tx.designChangeReview.createMany({
          data: reviewers.map((r) => ({ revisionId: latest.id, reviewerId: r.userId, role: r.role, decision: "PENDING" as const })),
        })
      }
    })

    // 追加新檔案（既有檔案保留）
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
        await writeFile(path.join(uploadDir, safeFileName), buffer)
        await prisma.designChangeDocument.create({
          data: { revisionId: latest.id, fileName: file.name, fileUrl: `/api/uploads/demands/${id}/${safeFileName}`, fileSize: file.size, uploadedById: auth.userId },
        })
      }
    }

    // 重新通知審核人（內容已更新，需重新確認）
    const phaseLabel = STATUS_MAP[dc.demand.status]?.label ?? dc.demand.status
    const recipients = [...new Set(reviewers.map((r) => r.userId).filter((uid) => uid !== auth.userId))]
    if (recipients.length > 0) {
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: "設計變更已更新，待重新確認",
        message: `需求 ${dc.demand.demandNumber}「${dc.demand.title}」的設計變更「${title}」（${phaseLabel}）已由管理者修改，請重新確認。`,
        linkUrl: `/demands/${id}`,
      })
    }
    logAudit({
      userId: auth.userId, action: "STATUS_CHANGE", entity: "SIGNOFF", entityId: dcId, demandId: id,
      details: { kind: "DESIGN_CHANGE_EDIT", seq: dc.seq, title, affectsSp },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Edit design change error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
