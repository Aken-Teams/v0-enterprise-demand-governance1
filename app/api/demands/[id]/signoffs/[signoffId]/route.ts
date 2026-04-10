import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { notifyUsers, getAdminUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/markdown",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// PATCH: Respond to sign-off (approve / reject), with optional file attachments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signoffId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, signoffId } = await params

    // Parse FormData (supports both files + text fields)
    const formData = await request.formData()
    const action = formData.get("action") as string | null
    const comment = formData.get("comment") as string | null
    const files = formData.getAll("files") as File[]

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "無效的操作" }, { status: 400 })
    }

    if (action === "reject" && !comment?.trim()) {
      return NextResponse.json({ error: "退回時必須填寫原因" }, { status: 400 })
    }

    // Validate files
    const validFiles = files.filter((f) => f.size > 0)
    for (const file of validFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `檔案「${file.name}」超過 10MB 限制` },
          { status: 400 }
        )
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `檔案「${file.name}」格式不支援 (${file.type})` },
          { status: 400 }
        )
      }
    }

    const signoff = await prisma.phaseSignoff.findUnique({
      where: { id: signoffId },
      include: {
        demand: { select: { id: true, demandNumber: true, title: true, submitterId: true, organizationId: true, managerId: true, developerId: true } },
      },
    })

    if (!signoff || signoff.demandId !== id) {
      return NextResponse.json({ error: "簽核記錄不存在" }, { status: 404 })
    }

    if (signoff.status !== "PENDING") {
      return NextResponse.json({ error: "此簽核已處理" }, { status: 400 })
    }

    // Auth check: admin bypasses; others must be the designated target user
    if (auth.role !== "admin") {
      if (signoff.targetUserId) {
        // New multi-signer: only the designated target can respond
        if (auth.userId !== signoff.targetUserId) {
          return NextResponse.json({ error: "此簽核指定由其他人員處理" }, { status: 403 })
        }
      } else {
        // Legacy signoff (no targetUserId): fall back to role-based check
        const access = await prisma.demandAccess.findUnique({
          where: { demandId_userId: { demandId: id, userId: auth.userId } },
          select: { signoffRole: true },
        })
        const userRole = access?.signoffRole

        const phase = signoff.phase as string
        if (phase === "PRD_REVIEW" || phase === "ACCEPTANCE") {
          if (userRole !== "REQUESTER" && userRole !== "MANAGER") {
            return NextResponse.json({ error: "您無權進行此簽核操作（需為需求者或主管）" }, { status: 403 })
          }
        } else if (phase === "SP_REVIEW") {
          if (userRole !== "BOARD") {
            return NextResponse.json({ error: "您無權進行此簽核操作（需為董事會）" }, { status: 403 })
          }
        } else {
          if (userRole !== "REQUESTER" && userRole !== "MANAGER") {
            return NextResponse.json({ error: "您無權進行此簽核操作" }, { status: 403 })
          }
        }
      }
    }

    const updated = await prisma.phaseSignoff.update({
      where: { id: signoffId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        comment: comment?.trim() || null,
        respondedAt: new Date(),
        respondedById: auth.userId,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        respondedBy: { select: { id: true, name: true } },
      },
    })

    // Save attached files (if any)
    if (validFiles.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })

      for (const file of validFiles) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(
          /[^a-zA-Z0-9._\-\u4e00-\u9fff]/g,
          "_"
        )}`
        const filePath = path.join(uploadDir, safeFileName)
        await writeFile(filePath, buffer)

        await prisma.demandDocument.create({
          data: {
            demandId: id,
            type: "ATTACHMENT",
            phase: signoff.phase as DemandStatus,
            fileName: file.name,
            fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size,
            uploadedBy: auth.userId,
            signoffId: updated.id,
          },
        })
      }
    }

    // Fire-and-forget: notify admin + manager + developer about signoff result + audit
    const actionLabel = action === "approve" ? "已確認" : "已退回"
    getAdminUserIds().then((adminIds) => {
      const targetIds = [
        ...adminIds,
        signoff.demand.managerId,
        signoff.demand.developerId,
      ].filter((uid): uid is string => uid !== null && uid !== auth.userId)
      const recipients = [...new Set(targetIds)]
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: `簽核${actionLabel}`,
        message: `需求 ${signoff.demand.demandNumber}「${signoff.demand.title}」的簽核已${actionLabel}。`,
        linkUrl: `/demands/${id}`,
      })
    })
    logAudit({
      userId: auth.userId,
      action: action === "approve" ? "SIGNOFF_APPROVE" : "SIGNOFF_REJECT",
      entity: "SIGNOFF",
      entityId: signoffId,
      demandId: id,
      details: { phase: signoff.phase, action },
      request,
    })

    return NextResponse.json({ signoff: updated })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update signoff error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PUT: Update requestComment (admin/delivery) or comment (subsidiary)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signoffId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, signoffId } = await params
    const body = await request.json()

    const signoff = await prisma.phaseSignoff.findUnique({
      where: { id: signoffId },
      select: { id: true, demandId: true, requestedById: true, demand: { select: { submitterId: true, organizationId: true } } },
    })

    if (!signoff || signoff.demandId !== id) {
      return NextResponse.json({ error: "簽核記錄不存在" }, { status: 404 })
    }

    // Determine which field is being updated based on role
    if ("requestComment" in body) {
      // Only admin/delivery can edit requestComment (提出說明)
      if (auth.role !== "admin" && auth.role !== "delivery") {
        return NextResponse.json({ error: "權限不足" }, { status: 403 })
      }
      const updated = await prisma.phaseSignoff.update({
        where: { id: signoffId },
        data: { requestComment: body.requestComment?.trim() || null },
      })
      return NextResponse.json({ success: true, requestComment: updated.requestComment })
    }

    if ("comment" in body) {
      // Only subsidiary can edit comment (審核回應)
      if (auth.role !== "subsidiary") {
        return NextResponse.json({ error: "權限不足" }, { status: 403 })
      }
      // Verify subsidiary belongs to same org
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { organizationId: true },
      })
      if (auth.userId !== signoff.demand.submitterId && user?.organizationId !== signoff.demand.organizationId) {
        return NextResponse.json({ error: "您無權修改此審核回應" }, { status: 403 })
      }
      const updated = await prisma.phaseSignoff.update({
        where: { id: signoffId },
        data: { comment: body.comment?.trim() || null },
      })
      return NextResponse.json({ success: true, comment: updated.comment })
    }

    return NextResponse.json({ error: "缺少更新欄位" }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update signoff field error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
