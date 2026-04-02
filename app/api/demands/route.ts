import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { calcUsedSp } from "@/lib/constants/demand"
import { createDemandSchema } from "@/lib/validations/demand"
import { generateDemandNumber } from "@/lib/demand-number"
import { buildDemandVisibilityFilter } from "@/lib/demand-access"
import { DemandStatus } from "@/lib/generated/prisma/client"
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

    // 9. Fire-and-forget: notification + audit
    notifyUsers([submitter.id], {
      type: "DEMAND_STATUS",
      title: "新需求已建立",
      message: `需求 ${demand.demandNumber}「${demand.title}」已建立。`,
      linkUrl: `/demands/${demand.id}`,
    })
    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "DEMAND",
      entityId: demand.id,
      demandId: demand.id,
      details: { demandNumber: demand.demandNumber, title: demand.title },
      request,
    })

    // 10. Return success
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

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus))

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")?.trim()
    const submitterId = searchParams.get("submitterId")
    const developerId = searchParams.get("developerId")
    const organizationId = searchParams.get("organizationId")

    // Server-side visibility filter based on user's whitelist
    const visibilityFilter = await buildDemandVisibilityFilter(auth)

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status && VALID_STATUSES.has(status)) {
      where.status = status
    }
    if (organizationId) {
      where.organizationId = organizationId
    }
    if (submitterId) {
      where.submitterId = submitterId
    }
    if (developerId) {
      where.developerId = developerId === "unassigned" ? null : developerId
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { demandNumber: { contains: search } },
        { organization: { name: { contains: search } } },
      ]
    }

    // Merge visibility filter into where clause
    const finalWhere = visibilityFilter
      ? { AND: [where, visibilityFilter] }
      : where

    // Build base filter for counts (same scope as list, minus search/status)
    const countWhere: Record<string, unknown> = {}
    if (organizationId) countWhere.organizationId = organizationId
    if (developerId) countWhere.developerId = developerId === "unassigned" ? null : developerId
    if (submitterId) countWhere.submitterId = submitterId

    const finalCountWhere = visibilityFilter
      ? { AND: [countWhere, visibilityFilter] }
      : countWhere

    // Fetch demands, counts, and filter options in parallel
    const [demands, total, counts, submitters, developers] = await Promise.all([
      prisma.demand.findMany({
        where: finalWhere,
        include: {
          organization: { select: { name: true } },
          submitter: { select: { name: true } },
          creator: { select: { name: true } },
          manager: { select: { name: true } },
          developer: { select: { name: true } },
          _count: { select: { documents: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.demand.count({ where: finalCountWhere }),
      prisma.demand.groupBy({
        by: ["status"],
        where: finalCountWhere,
        _count: { _all: true },
      }),
      // Admin and viewer get full filter options; others don't need them
      (auth.role === "admin" || auth.role === "viewer")
        ? prisma.user.findMany({
            where: { isActive: true, role: "subsidiary" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      (auth.role === "admin" || auth.role === "viewer")
        ? prisma.user.findMany({
            where: { isActive: true, role: { in: ["admin", "delivery"] } },
            select: { id: true, name: true, role: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ])

    // Build status count map
    const statusCounts: Record<string, number> = {}
    for (const c of counts) {
      statusCounts[c.status] = c._count._all
    }

    // SP wallet summary for organization-scoped queries (progressive consumption)
    let spSummary: { totalQuota: number; usedSp: number } | undefined
    if (organizationId) {
      const currentYear = new Date().getFullYear()
      const [wallet, orgDemands] = await Promise.all([
        prisma.spWallet.findFirst({
          where: { organizationId, year: currentYear },
          select: { totalQuota: true },
        }),
        prisma.demand.findMany({
          where: { organizationId, status: { not: "REJECTED" } },
          select: { status: true, estimatedSp: true, confirmedSp: true },
        }),
      ])
      const usedSp = orgDemands.reduce((sum, d) => sum + calcUsedSp(d.status, d.confirmedSp ?? d.estimatedSp), 0)
      spSummary = {
        totalQuota: wallet?.totalQuota ?? 0,
        usedSp,
      }
    }

    return NextResponse.json({
      demands: demands.map((d) => ({
        id: d.id,
        demandNumber: d.demandNumber,
        title: d.title,
        description: d.description,
        status: d.status,
        priority: d.priority,
        estimatedSp: d.estimatedSp,
        confirmedSp: d.confirmedSp,
        desiredDate: d.desiredDate,
        createdAt: d.createdAt,
        organization: d.organization.name,
        submitter: d.submitter.name,
        creator: d.creator.name,
        manager: d.manager?.name || null,
        developer: d.developer?.name || null,
        contactPerson: d.contactPerson || null,
        documentCount: d._count.documents,
        commentCount: d._count.comments,
      })),
      total,
      statusCounts,
      ...(spSummary ? { spSummary } : {}),
      filters: {
        submitters: submitters.map((u) => ({ id: u.id, name: u.name })),
        developers: developers.map((u) => ({ id: u.id, name: u.name, role: u.role })),
        assignableUsers: [
          ...developers.map((u) => ({ id: u.id, name: u.name, role: u.role })),
          ...submitters.map((u) => ({ id: u.id, name: u.name, role: "subsidiary" as const })),
        ],
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("List demands error:", error)
    return NextResponse.json(
      { error: "伺服器錯誤，請稍後再試" },
      { status: 500 }
    )
  }
}
