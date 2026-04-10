import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { SIGNOFF_REQUIRED_PHASES, STATUS_MAP } from "@/lib/constants/demand"
import { notifyUsers, getOrgSubsidiaryUserIds } from "@/lib/notify"
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

// POST: Re-request sign-off (after rejection), with optional file attachments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    // Support both JSON and FormData
    const contentType = request.headers.get("content-type") || ""
    let phase: string | null = null
    let requestComment: string | null = null
    let files: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      phase = formData.get("phase") as string | null
      requestComment = formData.get("requestComment") as string | null
      files = (formData.getAll("files") as File[]).filter((f) => f.size > 0)

      // Validate files
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: `檔案「${file.name}」超過 10MB 限制` }, { status: 400 })
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          return NextResponse.json({ error: `檔案「${file.name}」格式不支援` }, { status: 400 })
        }
      }
    } else {
      const body = await request.json()
      phase = body.phase
      requestComment = body.requestComment
    }

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, demandNumber: true, title: true, status: true, organizationId: true },
    })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
    if (!phase || !signoffPhases.includes(phase)) {
      return NextResponse.json({ error: "無效的簽核階段" }, { status: 400 })
    }

    if (demand.status !== phase) {
      return NextResponse.json({ error: "只能對目前階段發起簽核" }, { status: 400 })
    }

    // Check no existing PENDING sign-off for this demand+phase
    const existing = await prisma.phaseSignoff.findFirst({
      where: { demandId: id, phase: phase as DemandStatus, status: "PENDING" },
    })
    if (existing) {
      return NextResponse.json({ error: "此階段已有待確認的簽核" }, { status: 409 })
    }

    // Determine target signers based on phase and demand assignments
    const demandFull = await prisma.demand.findUnique({
      where: { id },
      select: {
        contactPersonId: true,
        demandManagerId: true,
        contactPerson_: { select: { id: true, name: true } },
        demandManager: { select: { id: true, name: true } },
      },
    })

    type SignoffTarget = { userId: string; role: string }
    const targets: SignoffTarget[] = []

    if (phase === "PRD_REVIEW" || phase === "ACCEPTANCE") {
      if (demandFull?.contactPersonId) targets.push({ userId: demandFull.contactPersonId, role: "REQUESTER" })
      if (demandFull?.demandManagerId) targets.push({ userId: demandFull.demandManagerId, role: "MANAGER" })
    } else if (phase === "SP_REVIEW") {
      // Board members: find from DemandAccess with signoffRole=BOARD
      const boardAccess = await prisma.demandAccess.findMany({
        where: { demandId: id, signoffRole: "BOARD" },
        select: { userId: true },
      })
      for (const a of boardAccess) {
        targets.push({ userId: a.userId, role: "BOARD" })
      }
    }

    // Fallback: if no specific targets found, create one generic signoff (backward compat)
    if (targets.length === 0) {
      targets.push({ userId: "", role: "" })
    }

    // Use the same requestedAt for all signoffs in this round so they can be grouped
    const roundTime = new Date()
    const signoffs = await prisma.$transaction(
      targets.map((t) =>
        prisma.phaseSignoff.create({
          data: {
            demandId: id,
            phase: phase as DemandStatus,
            status: "PENDING",
            requestedById: auth.userId,
            requestComment: requestComment?.trim() || null,
            targetUserId: t.userId || null,
            targetRole: t.role || null,
            requestedAt: roundTime,
          },
          include: {
            requestedBy: { select: { id: true, name: true } },
          },
        })
      )
    )
    const signoff = signoffs[0]

    // Save attached files (if any)
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
            phase: phase as DemandStatus,
            fileName: file.name,
            fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size,
            uploadedBy: auth.userId,
            signoffId: signoff.id,
          },
        })
      }
    }

    // Fire-and-forget: notify target signers (or org subsidiary users as fallback) + audit
    const phaseLabel = STATUS_MAP[phase]?.label ?? phase
    const targetUserIds = targets.filter(t => t.userId).map(t => t.userId)
    if (targetUserIds.length > 0) {
      const recipients = targetUserIds.filter(uid => uid !== auth.userId)
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: "簽核請求",
        message: `需求 ${demand.demandNumber}「${demand.title}」在「${phaseLabel}」階段需要您的簽核確認。`,
        linkUrl: `/demands/${id}`,
      })
    } else {
      getOrgSubsidiaryUserIds(demand.organizationId).then((orgIds) => {
        const recipients = orgIds.filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "SIGNOFF",
          title: "簽核請求",
          message: `需求 ${demand.demandNumber}「${demand.title}」在「${phaseLabel}」階段需要您的簽核確認。`,
          linkUrl: `/demands/${id}`,
        })
      })
    }
    logAudit({
      userId: auth.userId,
      action: "SIGNOFF_REQUEST",
      entity: "SIGNOFF",
      entityId: signoff.id,
      demandId: id,
      details: { phase },
      request,
    })

    return NextResponse.json({ signoff })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Create signoff error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
