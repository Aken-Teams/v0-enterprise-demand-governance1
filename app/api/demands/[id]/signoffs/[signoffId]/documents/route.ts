import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"

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

// POST: Add documents to an existing signoff (post-hoc attachment)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signoffId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, signoffId } = await params

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    const validFiles = files.filter((f) => f.size > 0)
    if (validFiles.length === 0) {
      return NextResponse.json({ error: "請選擇至少一個檔案" }, { status: 400 })
    }

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
        demand: { select: { id: true, submitterId: true, organizationId: true } },
      },
    })

    if (!signoff || signoff.demandId !== id) {
      return NextResponse.json({ error: "簽核記錄不存在" }, { status: 404 })
    }

    // Only allow adding documents to REJECTED or APPROVED signoffs
    if (signoff.status !== "REJECTED" && signoff.status !== "APPROVED") {
      return NextResponse.json({ error: "僅可對已完成的簽核補充文件" }, { status: 400 })
    }

    // Auth check: subsidiary must be submitter or same org; admin always OK
    if (auth.role === "subsidiary") {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { organizationId: true },
      })
      if (
        auth.userId !== signoff.demand.submitterId &&
        user?.organizationId !== signoff.demand.organizationId
      ) {
        return NextResponse.json({ error: "您無權為此簽核補充文件" }, { status: 403 })
      }
    } else if (auth.role !== "admin") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    // Save files
    const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
    await mkdir(uploadDir, { recursive: true })

    const created = []
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
          type: "ATTACHMENT",
          phase: signoff.phase as DemandStatus,
          fileName: file.name,
          fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
          fileSize: file.size,
          uploadedBy: auth.userId,
          signoffId: signoff.id,
        },
        select: { id: true, fileName: true, fileUrl: true, fileSize: true },
      })
      created.push(doc)
    }

    return NextResponse.json({ documents: created })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Add signoff documents error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
