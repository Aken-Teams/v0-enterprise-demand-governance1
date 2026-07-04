import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { computeRevisionStatus } from "@/lib/design-change"
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

type ItemInput = { itemId: string; mark: "PENDING" | "CONFIRMED" | "CROSS" | "WARN"; comment?: string | null }

// POST: 審核人對某版本提交逐條回應 + 整體裁決（通過/駁回）+ 選填回饋與附件
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, dcId } = await params

    const formData = await request.formData()
    const revisionId = formData.get("revisionId") as string
    const decision = formData.get("decision") as "APPROVED" | "REJECTED"
    const overallComment = (formData.get("comment") as string | null)?.trim() || null
    let items: ItemInput[] = []
    try { items = JSON.parse((formData.get("items") as string) || "[]") } catch { items = [] }
    const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0)

    if (!revisionId) return NextResponse.json({ error: "缺少版本" }, { status: 400 })
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "請選擇通過或駁回" }, { status: 400 })
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `檔案「${file.name}」超過 10MB 限制` }, { status: 400 })
      if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: `檔案「${file.name}」格式不支援` }, { status: 400 })
      if (file.type === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALLOWED_EXTENSIONS.has(ext)) return NextResponse.json({ error: `檔案「${file.name}」格式不支援 (.${ext})` }, { status: 400 })
      }
    }

    const revision = await prisma.designChangeRevision.findUnique({
      where: { id: revisionId },
      include: {
        designChange: { include: { demand: { select: { id: true, demandNumber: true, title: true } } } },
        reviews: true,
        items: { select: { id: true } },
      },
    })
    if (!revision || revision.designChangeId !== dcId || revision.designChange.demandId !== id) {
      return NextResponse.json({ error: "版本不存在" }, { status: 404 })
    }
    if (revision.status !== "PENDING") return NextResponse.json({ error: "此版本已完成審核" }, { status: 400 })
    if (revision.version !== revision.designChange.currentVersion) {
      return NextResponse.json({ error: "僅能審核最新版本" }, { status: 400 })
    }

    const myReview = revision.reviews.find((r) => r.reviewerId === auth.userId)
    if (!myReview && auth.role !== "admin") {
      return NextResponse.json({ error: "您非此設計變更的指定審核人" }, { status: 403 })
    }
    if (myReview && myReview.decision !== "PENDING") {
      return NextResponse.json({ error: "您已審核過此版本" }, { status: 400 })
    }

    const validItemIds = new Set(revision.items.map((it) => it.id))
    for (const it of items) {
      if (!validItemIds.has(it.itemId)) continue
      if ((it.mark === "CROSS" || it.mark === "WARN") && !it.comment?.trim()) {
        return NextResponse.json({ error: "標記為有問題／疑慮的項目請填寫說明" }, { status: 400 })
      }
    }
    if (decision === "REJECTED" && !overallComment && !items.some((it) => it.mark === "CROSS" || it.mark === "WARN")) {
      return NextResponse.json({ error: "駁回請填寫總回應或標記問題項目" }, { status: 400 })
    }

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        if (!validItemIds.has(it.itemId)) continue
        await tx.designChangeItemFeedback.upsert({
          where: { itemId_reviewerId: { itemId: it.itemId, reviewerId: auth.userId } },
          create: { itemId: it.itemId, reviewerId: auth.userId, mark: it.mark, comment: it.comment?.trim() || null },
          update: { mark: it.mark, comment: it.comment?.trim() || null },
        })
      }
      if (myReview) {
        await tx.designChangeReview.update({ where: { id: myReview.id }, data: { decision, comment: overallComment, decidedAt: now } })
      } else {
        await tx.designChangeReview.create({ data: { revisionId, reviewerId: auth.userId, role: "MANAGER", decision, comment: overallComment, decidedAt: now } })
      }
      const allReviews = await tx.designChangeReview.findMany({ where: { revisionId }, select: { decision: true } })
      const revStatus = computeRevisionStatus(allReviews)
      if (revStatus !== "PENDING") {
        await tx.designChangeRevision.update({ where: { id: revisionId }, data: { status: revStatus, decidedAt: now } })
        await tx.designChange.update({ where: { id: dcId }, data: { status: revStatus } })
      }
    })

    // 審核人附件（存為該版本的文件，uploadedBy = 審核人）
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
        await writeFile(path.join(uploadDir, safeFileName), buffer)
        await prisma.designChangeDocument.create({
          data: {
            revisionId, fileName: file.name, fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size, docGroup: crypto.randomUUID(), fileVersion: 1, uploadedById: auth.userId,
          },
        })
      }
    }

    const proposerId = revision.submittedById
    if (proposerId !== auth.userId) {
      const decLabel = decision === "APPROVED" ? "已確認" : "已駁回"
      notifyUsers([proposerId], {
        type: "SIGNOFF",
        title: `設計變更${decLabel}`,
        message: `需求 ${revision.designChange.demand.demandNumber}「${revision.designChange.demand.title}」的設計變更「${revision.designChange.title}」v${revision.version} 被${decLabel}。`,
        linkUrl: `/demands/${id}`,
      })
    }
    logAudit({
      userId: auth.userId, action: decision === "APPROVED" ? "SIGNOFF_APPROVE" : "SIGNOFF_REJECT",
      entity: "SIGNOFF", entityId: dcId, demandId: id,
      details: { kind: "DESIGN_CHANGE_REVIEW", version: revision.version, decision, itemCount: items.length, files: files.length },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Design change review error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
