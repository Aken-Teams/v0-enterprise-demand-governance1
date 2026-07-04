import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { randomUUID } from "crypto"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { DemandStatus, DocumentType } from "@/lib/generated/prisma/client"
import { notifyUsers, getDemandStakeholderIds, getOrgSubsidiaryUserIds } from "@/lib/notify"
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
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "application/octet-stream", // fallback for .md etc. on Windows
])

// Extensions allowed when MIME is application/octet-stream
const ALLOWED_EXTENSIONS = new Set([
  "md", "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp",
  "mp3", "wav", "ogg", "mp4", "webm",
])

const MAX_FILE_SIZE_DEFAULT = 20 * 1024 * 1024 // 20MB
const MAX_FILE_SIZE_VIDEO = 50 * 1024 * 1024   // 50MB for video

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])

function getMaxFileSize(file: File): number {
  if (VIDEO_MIME_TYPES.has(file.type)) return MAX_FILE_SIZE_VIDEO
  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  if (ext === "mp4" || ext === "webm") return MAX_FILE_SIZE_VIDEO
  return MAX_FILE_SIZE_DEFAULT
}

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus))
const VALID_DOC_TYPES = new Set<string>(Object.values(DocumentType))

/** 驗證關聯設計變更是否屬於本需求；未提供則視為通過（不綁定） */
async function validateDesignChange(demandId: string, designChangeId: string | null | undefined): Promise<{ ok: boolean; id: string | null }> {
  if (!designChangeId) return { ok: true, id: null }
  const dc = await prisma.designChange.findFirst({ where: { id: designChangeId, demandId }, select: { id: true } })
  return dc ? { ok: true, id: dc.id } : { ok: false, id: null }
}

// GET: List documents for a demand, filterable by phase
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    verifyAuth(request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const phase = searchParams.get("phase")

    const where: Record<string, unknown> = { demandId: id }
    if (phase && VALID_STATUSES.has(phase)) {
      where.phase = phase
    }

    const documents = await prisma.demandDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get documents error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: Upload document(s) to a specific phase
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, demandNumber: true, title: true, organizationId: true },
    })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Admin write permission check
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id, organizationId: demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    const contentType = request.headers.get("content-type") || ""

    // ── JSON body: URL-based document (APP_RESULT) ──
    if (contentType.includes("application/json")) {
      const body = await request.json()
      const { phase, type, url, docGroup, changeNote, designChangeId } = body as {
        phase?: string; type?: string; url?: string
        docGroup?: string | null; changeNote?: string | null; designChangeId?: string | null
      }

      if (!url || typeof url !== "string" || !url.startsWith("http")) {
        return NextResponse.json({ error: "請提供有效的連結" }, { status: 400 })
      }
      const docType = type || "APP_RESULT"
      if (!VALID_DOC_TYPES.has(docType)) {
        return NextResponse.json({ error: "無效的文件類型" }, { status: 400 })
      }
      if (phase && !VALID_STATUSES.has(phase)) {
        return NextResponse.json({ error: "無效的階段" }, { status: 400 })
      }
      const dcCheck = await validateDesignChange(id, designChangeId)
      if (!dcCheck.ok) return NextResponse.json({ error: "無效的關聯設計變更" }, { status: 400 })

      // 版本群組：docGroup 提供 → 既有文件的新版本；否則產生新群組（版本 1）
      let group = docGroup || null
      let version = 1
      let finalType: string = docType
      let finalPhase: DemandStatus | null = phase ? (phase as DemandStatus) : null
      if (group) {
        const latest = await prisma.demandDocument.findFirst({
          where: { demandId: id, docGroup: group },
          orderBy: { version: "desc" },
          select: { version: true, type: true, phase: true },
        })
        if (!latest) return NextResponse.json({ error: "找不到要更新的文件版本群組" }, { status: 400 })
        version = latest.version + 1
        finalType = latest.type
        finalPhase = latest.phase
      } else {
        group = randomUUID()
      }

      const doc = await prisma.demandDocument.create({
        data: {
          demandId: id,
          type: finalType as DocumentType,
          phase: finalPhase,
          fileName: url,
          fileUrl: url,
          fileSize: null,
          uploadedBy: auth.userId,
          docGroup: group,
          version,
          changeNote: (changeNote || "").trim() || null,
          designChangeId: dcCheck.id,
        },
      })

      // Fire-and-forget: notification + audit for URL doc
      const stakeholderIds1 = getDemandStakeholderIds(id)
      const orgUserIds1 = getOrgSubsidiaryUserIds(demand.organizationId)
      Promise.all([stakeholderIds1, orgUserIds1]).then(([sIds, oIds]) => {
        const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "DOCUMENT",
          title: "新文件已上傳",
          message: `需求 ${demand.demandNumber}「${demand.title}」有新的連結文件。`,
          linkUrl: `/demands/${id}`,
        })
      })
      logAudit({
        userId: auth.userId,
        action: "UPLOAD",
        entity: "DOCUMENT",
        entityId: doc.id,
        demandId: id,
        details: { fileName: doc.fileName, type: doc.type },
        request,
      })

      return NextResponse.json(
        { documents: [{ id: doc.id, fileName: doc.fileName, fileSize: doc.fileSize, type: doc.type, phase: doc.phase }] },
        { status: 201 }
      )
    }

    // ── FormData body: file upload ──
    const formData = await request.formData()
    const phase = formData.get("phase") as string | null
    const docType = (formData.get("type") as string) || "ATTACHMENT"
    const docGroup = (formData.get("docGroup") as string | null) || null
    const changeNote = ((formData.get("changeNote") as string | null) || "").trim() || null
    const designChangeId = (formData.get("designChangeId") as string | null) || null

    if (phase && !VALID_STATUSES.has(phase)) {
      return NextResponse.json({ error: "無效的階段" }, { status: 400 })
    }
    if (!VALID_DOC_TYPES.has(docType)) {
      return NextResponse.json({ error: "無效的文件類型" }, { status: 400 })
    }
    const dcCheck = await validateDesignChange(id, designChangeId)
    if (!dcCheck.ok) return NextResponse.json({ error: "無效的關聯設計變更" }, { status: 400 })

    // 版本群組（更新既有文件時，沿用群組的 type/phase 並遞增版本）
    let baseVersion = 0
    let groupType: DocumentType | null = null
    let groupPhase: DemandStatus | null = null
    if (docGroup) {
      const latest = await prisma.demandDocument.findFirst({
        where: { demandId: id, docGroup },
        orderBy: { version: "desc" },
        select: { version: true, type: true, phase: true },
      })
      if (!latest) return NextResponse.json({ error: "找不到要更新的文件版本群組" }, { status: 400 })
      baseVersion = latest.version
      groupType = latest.type
      groupPhase = latest.phase
    }

    const files = formData.getAll("files") as File[]
    for (const file of files) {
      const maxSize = getMaxFileSize(file)
      if (file.size > maxSize) {
        const limitMB = maxSize / (1024 * 1024)
        return NextResponse.json(
          { error: `檔案「${file.name}」超過 ${limitMB}MB 限制` },
          { status: 400 }
        )
      }
      if (file.size > 0 && !ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `檔案 "${file.name}" 格式不支援 (${file.type})` },
          { status: 400 }
        )
      }
      // For octet-stream, verify by file extension
      if (file.size > 0 && file.type === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return NextResponse.json(
            { error: `檔案 "${file.name}" 格式不支援 (.${ext})` },
            { status: 400 }
          )
        }
      }
    }

    const validFiles = files.filter((f) => f.size > 0)
    if (validFiles.length === 0) {
      return NextResponse.json({ error: "請上傳至少一個檔案" }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
    await mkdir(uploadDir, { recursive: true })

    const isVersioning = !!docGroup
    const savedDocuments = []
    let vOffset = 0
    for (const file of validFiles) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const safeFileName = `${Date.now()}-${file.name.replace(
        /[^a-zA-Z0-9._\-\u4e00-\u9fff]/g,
        "_"
      )}`
      const filePath = path.join(uploadDir, safeFileName)
      await writeFile(filePath, buffer)

      vOffset++
      const doc = await prisma.demandDocument.create({
        data: {
          demandId: id,
          type: isVersioning ? groupType! : (docType as DocumentType),
          phase: isVersioning ? groupPhase : (phase ? (phase as DemandStatus) : null),
          fileName: file.name,
          fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
          fileSize: file.size,
          uploadedBy: auth.userId,
          docGroup: isVersioning ? docGroup : randomUUID(),
          version: isVersioning ? baseVersion + vOffset : 1,
          changeNote,
          designChangeId: dcCheck.id,
        },
      })
      savedDocuments.push(doc)
    }

    // Fire-and-forget: notification + audit for uploaded files
    const stakeholderIds2 = getDemandStakeholderIds(id)
    const orgUserIds2 = getOrgSubsidiaryUserIds(demand.organizationId)
    Promise.all([stakeholderIds2, orgUserIds2]).then(([sIds, oIds]) => {
      const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
      notifyUsers(recipients, {
        type: "DOCUMENT",
        title: "新文件已上傳",
        message: `需求 ${demand.demandNumber}「${demand.title}」有 ${savedDocuments.length} 個新文件上傳。`,
        linkUrl: `/demands/${id}`,
      })
    })
    for (const doc of savedDocuments) {
      logAudit({
        userId: auth.userId,
        action: "UPLOAD",
        entity: "DOCUMENT",
        entityId: doc.id,
        demandId: id,
        details: { fileName: doc.fileName, fileSize: doc.fileSize, type: doc.type },
        request,
      })
    }

    return NextResponse.json(
      {
        documents: savedDocuments.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileSize: d.fileSize,
          type: d.type,
          phase: d.phase,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Upload document error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
