import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { DESIGN_CHANGE_ALLOWED_PHASES, STATUS_MAP } from "@/lib/constants/demand"
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
  "text/markdown",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/octet-stream", // fallback for .md etc. on Windows
])

// Extensions allowed when MIME is application/octet-stream
const ALLOWED_EXTENSIONS = new Set([
  "md", "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// POST: Propose a design change (admin / delivery only)
// Creates PhaseSignoff records with kind="DESIGN_CHANGE" for REQUESTER and MANAGER (if assigned)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    // Parse FormData (supports reason + files)
    const formData = await request.formData()
    const requestComment = formData.get("requestComment") as string | null
    const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0)

    if (!requestComment?.trim()) {
      return NextResponse.json({ error: "請填寫設計變更原因" }, { status: 400 })
    }

    // Validate files
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `檔案「${file.name}」超過 10MB 限制` }, { status: 400 })
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: `檔案「${file.name}」格式不支援` }, { status: 400 })
      }
      // For octet-stream (e.g. .md on Windows), verify by file extension
      if (file.type === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return NextResponse.json({ error: `檔案「${file.name}」格式不支援 (.${ext})` }, { status: 400 })
        }
      }
    }

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true,
        demandNumber: true,
        title: true,
        status: true,
        organizationId: true,
        contactPersonId: true,
        demandManagerId: true,
        contactPerson_: { select: { id: true, name: true } },
        demandManager: { select: { id: true, name: true } },
      },
    })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Admin write permission check
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id,
        organizationId: demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    // Phase check
    const allowed = DESIGN_CHANGE_ALLOWED_PHASES as readonly string[]
    if (!allowed.includes(demand.status)) {
      return NextResponse.json(
        { error: "設計變更僅能於 MVP / 開案 / 驗收階段提出" },
        { status: 400 }
      )
    }

    // No pending design change exists
    const existing = await prisma.phaseSignoff.findFirst({
      where: { demandId: id, kind: "DESIGN_CHANGE", status: "PENDING" },
    })
    if (existing) {
      return NextResponse.json({ error: "已有待確認的設計變更" }, { status: 409 })
    }

    // Must have contact person
    if (!demand.contactPersonId) {
      return NextResponse.json({ error: "請先指派需求窗口" }, { status: 400 })
    }

    type SignoffTarget = { userId: string; role: string }
    const targets: SignoffTarget[] = []
    targets.push({ userId: demand.contactPersonId, role: "REQUESTER" })
    if (demand.demandManagerId) {
      targets.push({ userId: demand.demandManagerId, role: "MANAGER" })
    }

    // Create signoffs for this round
    const roundTime = new Date()
    const signoffs = await prisma.$transaction(
      targets.map((t) =>
        prisma.phaseSignoff.create({
          data: {
            demandId: id,
            phase: demand.status as DemandStatus,
            kind: "DESIGN_CHANGE",
            status: "PENDING",
            requestedById: auth.userId,
            requestComment: requestComment.trim(),
            targetUserId: t.userId,
            targetRole: t.role,
            requestedAt: roundTime,
          },
          include: {
            requestedBy: { select: { id: true, name: true } },
          },
        })
      )
    )
    const signoff = signoffs[0]

    // Save attached files (linked to first signoff; all signers share the same documents)
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_")}`
        const filePath = path.join(uploadDir, safeFileName)
        await writeFile(filePath, buffer)

        await prisma.demandDocument.create({
          data: {
            demandId: id,
            type: "ATTACHMENT",
            phase: demand.status as DemandStatus,
            fileName: file.name,
            fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size,
            uploadedBy: auth.userId,
            signoffId: signoff.id,
          },
        })
      }
    }

    // Notify targets
    const phaseLabel = STATUS_MAP[demand.status]?.label ?? demand.status
    const recipients = targets.map((t) => t.userId).filter((uid) => uid !== auth.userId)
    if (recipients.length > 0) {
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: "設計變更待確認",
        message: `需求 ${demand.demandNumber}「${demand.title}」在「${phaseLabel}」階段提出設計變更，請您審核確認。`,
        linkUrl: `/demands/${id}`,
      })
    }

    logAudit({
      userId: auth.userId,
      action: "SIGNOFF_REQUEST",
      entity: "SIGNOFF",
      entityId: signoff.id,
      demandId: id,
      details: { kind: "DESIGN_CHANGE", phase: demand.status },
      request,
    })

    return NextResponse.json({ signoffs })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Create design change error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
