import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus, DocumentType } from "@/lib/generated/prisma/client"

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
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB for audio/video

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus))
const VALID_DOC_TYPES = new Set<string>(Object.values(DocumentType))

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

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const formData = await request.formData()
    const phase = formData.get("phase") as string | null
    const docType = (formData.get("type") as string) || "ATTACHMENT"

    if (phase && !VALID_STATUSES.has(phase)) {
      return NextResponse.json({ error: "無效的階段" }, { status: 400 })
    }
    if (!VALID_DOC_TYPES.has(docType)) {
      return NextResponse.json({ error: "無效的文件類型" }, { status: 400 })
    }

    const files = formData.getAll("files") as File[]
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `檔案 "${file.name}" 超過大小限制` },
          { status: 400 }
        )
      }
      if (file.size > 0 && !ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `檔案 "${file.name}" 格式不支援 (${file.type})` },
          { status: 400 }
        )
      }
    }

    const validFiles = files.filter((f) => f.size > 0)
    if (validFiles.length === 0) {
      return NextResponse.json({ error: "請上傳至少一個檔案" }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
    await mkdir(uploadDir, { recursive: true })

    const savedDocuments = []
    for (const file of validFiles) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const safeFileName = `${Date.now()}-${file.name.replace(
        /[^a-zA-Z0-9._\-\u4e00-\u9fff]/g,
        "_"
      )}`
      const filePath = path.join(uploadDir, safeFileName)
      await writeFile(filePath, buffer)

      const doc = await prisma.demandDocument.create({
        data: {
          demandId: id,
          type: docType as DocumentType,
          phase: phase ? (phase as DemandStatus) : null,
          fileName: file.name,
          fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
          fileSize: file.size,
          uploadedBy: auth.userId,
        },
      })
      savedDocuments.push(doc)
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
