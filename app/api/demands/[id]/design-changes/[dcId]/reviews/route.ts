import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import type { DesignChangeStage } from "@/lib/design-change"
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
    // 每個檔案對應的 checklistItemId（與 files 同序，"" = 版本層級附件）
    let fileItemIds: string[] = []
    try { fileItemIds = JSON.parse((formData.get("fileItemIds") as string) || "[]") } catch { fileItemIds = [] }
    const rawFiles = formData.getAll("files") as File[]
    // 保留原始索引以對應 fileItemIds，再濾掉空檔
    const files = rawFiles.map((f, i) => ({ file: f, itemId: fileItemIds[i] || null })).filter((x) => x.file.size > 0)

    if (!revisionId) return NextResponse.json({ error: "缺少版本" }, { status: 400 })
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "請選擇通過或駁回" }, { status: 400 })
    }
    for (const { file } of files) {
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
        designChange: {
          include: {
            demand: {
              select: {
                id: true, demandNumber: true, title: true, organizationId: true,
                contactPersonId: true, demandManagerId: true,
              },
            },
          },
        },
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

    // 兩階段流程：設計變更確認(GATE) 未通過前一律為 GATE 階段，通過後才進入逐條確認(CONTENT)
    const activeStage: DesignChangeStage = revision.gateStatus === "APPROVED" ? "CONTENT" : "GATE"
    const stageReviews = revision.reviews.filter((r) => r.stage === activeStage)

    const myReview = stageReviews.find((r) => r.reviewerId === auth.userId)
    if (!myReview && auth.role !== "admin") {
      return NextResponse.json({ error: "您非此設計變更於目前階段的指定審核人" }, { status: 403 })
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
    // 通過必須每一條 checklist 都確認；設計變更確認只裁決「准不准開」，不受此限
    if (decision === "APPROVED" && activeStage === "CONTENT") {
      const confirmed = new Set(items.filter((it) => it.mark === "CONFIRMED").map((it) => it.itemId))
      const allConfirmed = revision.items.every((it) => confirmed.has(it.id))
      if (!allConfirmed) {
        return NextResponse.json({ error: "需全部檢查項目都確認後才能通過" }, { status: 400 })
      }
    }

    // 設計變更確認通過後要建立的逐條確認審核人：
    // 沿用第一階段的需求窗口（保留當初手動指定的對象）+ 需求主管（若有）
    const gateRequesterId =
      revision.reviews.find((r) => r.stage === "GATE" && r.role === "REQUESTER")?.reviewerId ??
      revision.designChange.demand.contactPersonId
    const contentTargets: { userId: string; role: string }[] = []
    if (gateRequesterId) contentTargets.push({ userId: gateRequesterId, role: "REQUESTER" })
    const mgrId = revision.designChange.demand.demandManagerId
    if (mgrId && mgrId !== gateRequesterId) contentTargets.push({ userId: mgrId, role: "MANAGER" })

    type Outcome = "REJECTED" | "APPROVED" | "TO_CONTENT" | "PENDING"

    const now = new Date()
    const outcome: Outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      let result: Outcome = "PENDING"
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
        // 管理者代審：補一筆該階段的審核紀錄
        await tx.designChangeReview.create({
          data: { revisionId, reviewerId: auth.userId, role: "MANAGER", stage: activeStage, decision, comment: overallComment, decidedAt: now },
        })
      }
      // 只彙總「目前階段」的裁決——設計變更確認與逐條確認各自獨立結算
      const stageAll = await tx.designChangeReview.findMany({
        where: { revisionId, stage: activeStage },
        select: { decision: true },
      })
      if (stageAll.some((r) => r.decision === "REJECTED")) {
        result = "REJECTED"
      } else if (stageAll.every((r) => r.decision === "APPROVED")) {
        result = activeStage === "GATE" ? "TO_CONTENT" : "APPROVED"
      }

      if (result === "TO_CONTENT") {
        // 設計變更確認通過 → 記錄結果並開啟逐條確認（版本本身維持待確認）
        await tx.designChangeRevision.update({ where: { id: revisionId }, data: { gateStatus: "APPROVED" } })
        if (contentTargets.length > 0) {
          await tx.designChangeReview.createMany({
            data: contentTargets.map((t) => ({
              revisionId, reviewerId: t.userId, role: t.role, stage: "CONTENT", decision: "PENDING" as const,
            })),
          })
        } else {
          // 無可指派的逐條確認人 → 視同直接通過，避免流程卡死
          result = "APPROVED"
        }
      }
      if (result === "REJECTED" || result === "APPROVED") {
        await tx.designChangeRevision.update({
          where: { id: revisionId },
          data: {
            status: result,
            decidedAt: now,
            // 第一階段被駁回 → 一併記錄該階段結果
            ...(activeStage === "GATE" ? { gateStatus: result } : {}),
          },
        })
        await tx.designChange.update({ where: { id: dcId }, data: { status: result } })
      }
      return result
    })

    // 審核人附件（存為該版本的文件，uploadedBy = 審核人；可綁定 checklist 項目）
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })
      for (const { file, itemId } of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
        await writeFile(path.join(uploadDir, safeFileName), buffer)
        await prisma.designChangeDocument.create({
          data: {
            revisionId, fileName: file.name, fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size, docGroup: crypto.randomUUID(), fileVersion: 1, uploadedById: auth.userId,
            checklistItemId: itemId && validItemIds.has(itemId) ? itemId : null,
          },
        })
      }
    }

    const dm = revision.designChange.demand
    const dcTitle = revision.designChange.title
    if (outcome === "TO_CONTENT") {
      const contentIds = [...new Set(contentTargets.map((t) => t.userId).filter((uid) => uid !== auth.userId))]
      if (contentIds.length > 0) {
        notifyUsers(contentIds, {
          type: "SIGNOFF",
          title: "設計變更待逐項確認",
          message: `需求 ${dm.demandNumber}「${dm.title}」的設計變更「${dcTitle}」已通過設計變更確認（董事會與需求窗口皆同意），請您逐項確認變更內容。`,
          linkUrl: `/demands/${id}`,
        })
      }
    } else if (outcome === "REJECTED" || outcome === "APPROVED") {
      const proposerId = revision.submittedById
      if (proposerId !== auth.userId) {
        const decLabel = outcome === "APPROVED" ? "已通過" : "已駁回"
        notifyUsers([proposerId], {
          type: "SIGNOFF",
          title: `設計變更${decLabel}`,
          message: `需求 ${dm.demandNumber}「${dm.title}」的設計變更「${dcTitle}」v${revision.version} ${decLabel}。`,
          linkUrl: `/demands/${id}`,
        })
      }
    }
    logAudit({
      userId: auth.userId, action: decision === "APPROVED" ? "SIGNOFF_APPROVE" : "SIGNOFF_REJECT",
      entity: "SIGNOFF", entityId: dcId, demandId: id,
      details: { kind: "DESIGN_CHANGE_REVIEW", stage: activeStage, version: revision.version, decision, outcome, itemCount: items.length, files: files.length },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Design change review error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PATCH: 暫存審核進度 —— 儲存逐條標記／說明／附件，但「不」做最終裁決（維持待確認）。
// 讓審核人可分次完成，不必一次確認完所有項目。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, dcId } = await params

    const formData = await request.formData()
    const revisionId = formData.get("revisionId") as string
    const overallComment = (formData.get("comment") as string | null) ?? ""
    let items: ItemInput[] = []
    try { items = JSON.parse((formData.get("items") as string) || "[]") } catch { items = [] }
    let fileItemIds: string[] = []
    try { fileItemIds = JSON.parse((formData.get("fileItemIds") as string) || "[]") } catch { fileItemIds = [] }
    const rawFiles = formData.getAll("files") as File[]
    const files = rawFiles.map((f, i) => ({ file: f, itemId: fileItemIds[i] || null })).filter((x) => x.file.size > 0)

    if (!revisionId) return NextResponse.json({ error: "缺少版本" }, { status: 400 })
    for (const { file } of files) {
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
        designChange: { select: { demandId: true, currentVersion: true } },
        reviews: true,
        items: { select: { id: true } },
      },
    })
    if (!revision || revision.designChangeId !== dcId || revision.designChange.demandId !== id) {
      return NextResponse.json({ error: "版本不存在" }, { status: 404 })
    }
    if (revision.status !== "PENDING") return NextResponse.json({ error: "此版本已完成審核" }, { status: 400 })
    if (revision.version !== revision.designChange.currentVersion) {
      return NextResponse.json({ error: "僅能暫存最新版本" }, { status: 400 })
    }
    const activeStage: DesignChangeStage = revision.gateStatus === "APPROVED" ? "CONTENT" : "GATE"
    const myReview = revision.reviews.find((r) => r.reviewerId === auth.userId && r.stage === activeStage)
    if (!myReview) return NextResponse.json({ error: "您非此設計變更於目前階段的指定審核人" }, { status: 403 })
    if (myReview.decision !== "PENDING") return NextResponse.json({ error: "您已審核過此版本" }, { status: 400 })

    const validItemIds = new Set(revision.items.map((it) => it.id))
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        if (!validItemIds.has(it.itemId)) continue
        if (it.mark === "PENDING") {
          // 取消標記 → 移除既有暫存回饋
          await tx.designChangeItemFeedback.deleteMany({ where: { itemId: it.itemId, reviewerId: auth.userId } })
        } else {
          await tx.designChangeItemFeedback.upsert({
            where: { itemId_reviewerId: { itemId: it.itemId, reviewerId: auth.userId } },
            create: { itemId: it.itemId, reviewerId: auth.userId, mark: it.mark, comment: it.comment?.trim() || null },
            update: { mark: it.mark, comment: it.comment?.trim() || null },
          })
        }
      }
      // 暫存整體回應（維持待確認，不設 decidedAt）
      await tx.designChangeReview.update({ where: { id: myReview.id }, data: { comment: overallComment.trim() || null } })
    })

    // 暫存附件（存為該版本的文件，uploadedBy = 審核人；可綁定 checklist 項目）
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })
      for (const { file, itemId } of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
        await writeFile(path.join(uploadDir, safeFileName), buffer)
        await prisma.designChangeDocument.create({
          data: {
            revisionId, fileName: file.name, fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size, docGroup: crypto.randomUUID(), fileVersion: 1, uploadedById: auth.userId,
            checklistItemId: itemId && validItemIds.has(itemId) ? itemId : null,
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Design change draft save error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
