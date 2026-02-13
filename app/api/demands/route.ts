import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { createDemandSchema } from "@/lib/validations/demand"
import { generateDemandNumber } from "@/lib/demand-number"

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

export async function POST(request: NextRequest) {
  try {
    // 1. Auth: admin only
    const auth = verifyRole(request, ["admin"])

    // 2. Parse FormData
    const formData = await request.formData()

    // 3. Validate text fields
    const rawData = {
      organizationId: formData.get("organizationId") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      painPoint: formData.get("painPoint") as string,
      expectedBenefit: formData.get("expectedBenefit") as string,
      estimatedSp: formData.get("estimatedSp") as string,
      desiredDate: formData.get("desiredDate") as string,
      adminNotes: formData.get("adminNotes") as string,
    }

    const parseResult = createDemandSchema.safeParse(rawData)
    if (!parseResult.success) {
      const errors = parseResult.error.flatten().fieldErrors
      return NextResponse.json(
        { error: "欄位驗證失敗", details: errors },
        { status: 400 }
      )
    }
    const validated = parseResult.data

    // 4. Validate files
    const files = formData.getAll("files") as File[]
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `檔案 "${file.name}" 超過 10MB 限制` },
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
    // Filter out empty file entries (browser may send empty File objects)
    const validFiles = files.filter((f) => f.size > 0)

    // 5. Verify organization & find submitter
    const org = await prisma.organization.findUnique({
      where: { id: validated.organizationId },
      include: {
        users: {
          where: { isActive: true, role: "subsidiary" },
          take: 1,
        },
      },
    })
    if (!org) {
      return NextResponse.json(
        { error: "指定的組織不存在" },
        { status: 400 }
      )
    }

    // Auto-select the subsidiary user as submitter
    const submitter = org.users[0]
    if (!submitter) {
      return NextResponse.json(
        { error: "該組織沒有可用的需求提出者" },
        { status: 400 }
      )
    }

    // 6. Generate demand number
    const demandNumber = await generateDemandNumber()

    // 7. Create demand + status history in transaction
    const demand = await prisma.$transaction(async (tx) => {
      const newDemand = await tx.demand.create({
        data: {
          demandNumber,
          title: validated.title,
          description: validated.description,
          painPoint: validated.painPoint || null,
          expectedBenefit: validated.expectedBenefit || null,
          status: "SUBMITTED",
          priority: "medium",
          estimatedSp: validated.estimatedSp,
          desiredDate: validated.desiredDate || null,
          adminNotes: validated.adminNotes || null,
          organizationId: validated.organizationId,
          submitterId: submitter.id,
          creatorId: auth.userId,
        },
      })

      await tx.demandStatusHistory.create({
        data: {
          demandId: newDemand.id,
          fromStatus: null,
          toStatus: "SUBMITTED",
          comment: "需求建立",
          changedBy: auth.userId,
        },
      })

      return newDemand
    })

    // 8. Save uploaded files
    const savedDocuments = []
    if (validFiles.length > 0) {
      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        "demands",
        demand.id
      )
      await mkdir(uploadDir, { recursive: true })

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
            demandId: demand.id,
            type: "ATTACHMENT",
            fileName: file.name,
            fileUrl: `/api/uploads/demands/${demand.id}/${safeFileName}`,
            fileSize: file.size,
            uploadedBy: auth.userId,
          },
        })
        savedDocuments.push(doc)
      }
    }

    // 9. Return success
    return NextResponse.json(
      {
        message: "需求建立成功",
        demand: {
          id: demand.id,
          demandNumber: demand.demandNumber,
          title: demand.title,
          status: demand.status,
        },
        documents: savedDocuments.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileSize: d.fileSize,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Create demand error:", error)
    return NextResponse.json(
      { error: "伺服器錯誤，請稍後再試" },
      { status: 500 }
    )
  }
}
