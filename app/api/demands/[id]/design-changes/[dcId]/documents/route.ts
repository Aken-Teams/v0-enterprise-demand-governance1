import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
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

// POST: 上傳附件到最新版本；帶 docGroup 則視為該檔的新版本
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, dcId } = await params

    const formData = await request.formData()
    const docGroup = (formData.get("docGroup") as string | null)?.trim() || null
    const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0)
    if (files.length === 0) return NextResponse.json({ error: "請選擇檔案" }, { status: 400 })

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
        demand: { select: { id: true, organizationId: true } },
        revisions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    })
    if (!dc || dc.demandId !== id) return NextResponse.json({ error: "設計變更不存在" }, { status: 404 })
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id: dc.demand.id, organizationId: dc.demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }
    const revisionId = dc.revisions[0]?.id
    if (!revisionId) return NextResponse.json({ error: "找不到版本" }, { status: 400 })

    // 版本群組：帶入既有群組則接續版本號，否則各自成新群組（可日後換版）
    let nextVersion = 1
    let group = docGroup
    if (docGroup) {
      const maxDoc = await prisma.designChangeDocument.findFirst({
        where: { docGroup, revision: { designChangeId: dcId } },
        orderBy: { fileVersion: "desc" }, select: { fileVersion: true },
      })
      nextVersion = (maxDoc?.fileVersion ?? 0) + 1
    }

    const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
    await mkdir(uploadDir, { recursive: true })
    const created: { id: string; fileName: string; docGroup: string | null; fileVersion: number }[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_")}`
      await writeFile(path.join(uploadDir, safeFileName), buffer)
      const thisGroup = group ?? crypto.randomUUID()
      const doc = await prisma.designChangeDocument.create({
        data: {
          revisionId, fileName: file.name, fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
          fileSize: file.size, docGroup: thisGroup, fileVersion: docGroup ? nextVersion : 1, uploadedById: auth.userId,
        },
        select: { id: true, fileName: true, docGroup: true, fileVersion: true },
      })
      created.push(doc)
      if (docGroup) nextVersion++
    }

    logAudit({
      userId: auth.userId, action: "UPLOAD", entity: "DEMAND", entityId: id, demandId: id,
      details: { kind: "DESIGN_CHANGE_DOC", dcId, count: created.length, versioned: !!docGroup },
      request,
    })

    return NextResponse.json({ documents: created }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Design change document upload error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
