import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { calcUsedSp, PHASE_DOCUMENT_MAP, DOCUMENT_TYPE_LABELS } from "@/lib/constants/demand"
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
    // 1. Auth: admin only (full scope required to create demands)
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

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
      vendor: (formData.get("vendor") as string) || undefined,
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
          vendor: validated.vendor || "JV",
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
    const vendor = searchParams.get("vendor")

    // Server-side visibility filter based on user's whitelist
    const visibilityFilter = await buildDemandVisibilityFilter(auth)

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status === "TERMINATED") {
      // 顯示用狀態：代簽直接結案（狀態仍為 CLOSED）
      where.status = "CLOSED"
      where.isTerminated = true
    } else if (status === "CLOSED") {
      // 「已結案」排除已終止（兩者分開呈現）
      where.status = "CLOSED"
      where.isTerminated = false
    } else if (status && VALID_STATUSES.has(status)) {
      where.status = status
    }
    if (organizationId) {
      where.organizationId = organizationId
    }
    if (vendor) {
      where.vendor = vendor
    }
    if (submitterId) {
      where.OR = [
        { submitterId },
        { contactPersonId: submitterId },
      ]
    }
    if (developerId) {
      where.developerId = developerId === "unassigned" ? null : developerId
    }
    if (search) {
      // If submitterId already set OR, merge with AND
      const searchOR = [
        { title: { contains: search } },
        { demandNumber: { contains: search } },
        { organization: { name: { contains: search } } },
      ]
      if (where.OR) {
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: searchOR }]
      } else {
        where.OR = searchOR
      }
    }

    // Merge visibility filter into where clause
    const finalWhere = visibilityFilter
      ? { AND: [where, visibilityFilter] }
      : where

    // Build base filter for counts (same scope as list, minus search/status)
    const countWhere: Record<string, unknown> = {}
    if (organizationId) countWhere.organizationId = organizationId
    if (developerId) countWhere.developerId = developerId === "unassigned" ? null : developerId
    if (submitterId) countWhere.OR = [{ submitterId }, { contactPersonId: submitterId }]

    const finalCountWhere = visibilityFilter
      ? { AND: [countWhere, visibilityFilter] }
      : countWhere

    // Fetch demands, counts, and filter options in parallel
    const [demands, total, counts, submitters, developers, organizations] = await Promise.all([
      prisma.demand.findMany({
        where: finalWhere,
        include: {
          organization: { select: { name: true } },
          submitter: { select: { name: true } },
          creator: { select: { name: true } },
          manager: { select: { name: true } },
          developer: { select: { name: true } },
          contactPerson_: { select: { name: true } },
          demandManager: { select: { name: true } },
          documents: { select: { type: true, phase: true } },
          _count: { select: { comments: true } },
          phaseSignoffs: {
            where: {
              OR: [
                { kind: "DESIGN_CHANGE", status: "PENDING" },
                { kind: "PHASE" },
              ],
            },
            select: {
              id: true, phase: true, status: true, kind: true,
              requestedAt: true, targetUserId: true,
              targetRole: true, overrideTargetStatus: true, requestComment: true,
            },
          },
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
            select: { id: true, name: true, organizationId: true, organization: { select: { name: true } } },
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
      // Organizations for filter dropdown
      (auth.role === "admin" || auth.role === "viewer")
        ? prisma.organization.findMany({
            where: { status: "active" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ])

    // Build status count map
    const statusCounts: Record<string, number> = {}
    for (const c of counts) {
      statusCounts[c.status] = c._count._all
    }
    // 已終止（代簽直接結案）從已結案中拆出來單獨計數
    const terminatedCount = await prisma.demand.count({
      where: { AND: [finalCountWhere, { status: "CLOSED", isTerminated: true }] },
    })
    statusCounts["TERMINATED"] = terminatedCount
    if (statusCounts["CLOSED"]) statusCounts["CLOSED"] = Math.max(0, statusCounts["CLOSED"] - terminatedCount)

    // SP wallet summary for organization-scoped queries (progressive consumption)
    let spSummary: { totalQuota: number; usedSp: number; byVendor?: { vendor: string; totalQuota: number; usedSp: number; availableSp: number }[] } | undefined
    if (organizationId) {
      const currentYear = new Date().getFullYear()
      const [wallets, orgDemands] = await Promise.all([
        prisma.spWallet.findMany({
          where: { organizationId, year: currentYear },
          select: { vendor: true, totalQuota: true },
        }),
        prisma.demand.findMany({
          where: { organizationId, status: { notIn: ["REJECTED"] } },
          select: { vendor: true, status: true, estimatedSp: true, confirmedSp: true, heldFromStatus: true },
        }),
      ])
      const totalQuota = wallets.reduce((s, w) => s + w.totalQuota, 0)
      const usedSp = orgDemands.reduce((sum, d) => sum + calcUsedSp(d.status, d.confirmedSp ?? d.estimatedSp, d.heldFromStatus), 0)
      // Per-vendor breakdown
      const vendorSet = new Set([...wallets.map(w => w.vendor), ...orgDemands.map(d => d.vendor)])
      const byVendor = Array.from(vendorSet).sort().map((vendor) => {
        const vQuota = wallets.find(w => w.vendor === vendor)?.totalQuota ?? 0
        const vUsed = orgDemands.filter(d => d.vendor === vendor).reduce((s, d) => s + calcUsedSp(d.status, d.confirmedSp ?? d.estimatedSp, d.heldFromStatus), 0)
        return { vendor, totalQuota: vQuota, usedSp: vUsed, availableSp: vQuota - vUsed }
      })
      spSummary = { totalQuota, usedSp, byVendor: byVendor.length > 1 ? byVendor : undefined }
    }

    return NextResponse.json({
      demands: demands.map((d) => {
        type SignoffRow = {
          phase: string; status: string; kind: string;
          requestedAt: Date; targetUserId: string | null;
          targetRole: string | null; overrideTargetStatus: string | null;
          requestComment: string | null;
        }
        const signoffs = d.phaseSignoffs as unknown as SignoffRow[]
        // Only show rejection if the LATEST round of signoffs has a REJECTED entry
        // Exclude orphan signoffs (no assigned user) to match detail page logic
        const phaseSignoffs = signoffs.filter(s => s.kind === "PHASE" && s.phase === d.status && s.targetUserId)
        const latestRoundTime = phaseSignoffs.length > 0
          ? Math.max(...phaseSignoffs.map(s => new Date(s.requestedAt).getTime()))
          : 0
        const latestRound = phaseSignoffs.filter(s => new Date(s.requestedAt).getTime() === latestRoundTime)
        const hasCurrentPhaseReject = latestRound.some(s => s.status === "REJECTED")
        const hasCurrentPhaseApproved = latestRound.length > 0 && latestRound.every(s => s.status === "APPROVED" || s.status === "SKIPPED") && latestRound.some(s => s.status === "APPROVED")
        // Current phase: missing docs
        const requiredDocs = PHASE_DOCUMENT_MAP[d.status]?.required || []
        const missingDocs = requiredDocs
          .filter(type => !d.documents.some(doc => doc.phase === d.status && doc.type === type))
          .map(type => DOCUMENT_TYPE_LABELS[type] || type)

        // Signoff status for current phase
        const pendingSignoffs = latestRound.filter(s => s.status === "PENDING").length
        const totalSignoffs = latestRound.length

        return {
          id: d.id,
          demandNumber: d.demandNumber,
          title: d.title,
          description: d.description,
          status: d.status,
          isTerminated: (d as unknown as { isTerminated?: boolean }).isTerminated ?? false,
          vendor: d.vendor,
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
          contactPerson: (d as unknown as { contactPerson_: { name: string } | null }).contactPerson_?.name || null,
          demandManager: d.demandManager?.name || null,
          documentCount: d.documents.length,
          commentCount: d._count.comments,
          hasPendingDesignChange: signoffs.some(
            (s) => s.kind === "DESIGN_CHANGE" && s.phase === d.status,
          ),
          hasCurrentPhaseReject,
          hasCurrentPhaseApproved,
          // 有待客戶 Master 確認的代簽終止結算 → 前端顯示「終止簽核中」
          hasPendingSettlement: signoffs.some(
            (s) => s.targetRole === "BOARD_OVERRIDE" && s.status === "PENDING" && !!s.overrideTargetStatus,
          ),
          // 已終止原因：取通過的代簽（BOARD_OVERRIDE）之申請說明
          terminatedReason: (d as unknown as { isTerminated?: boolean }).isTerminated
            ? (signoffs.find((s) => s.targetRole === "BOARD_OVERRIDE" && s.status === "APPROVED" && s.requestComment)?.requestComment ?? null)
            : null,
          holdReason: (d as unknown as { holdReason: string | null }).holdReason || null,
          phaseCompletion: { missingDocs, pendingSignoffs, totalSignoffs },
        }
      }),
      total,
      statusCounts,
      ...(spSummary ? { spSummary } : {}),
      filters: {
        submitters: submitters.map((u: { id: string; name: string; organizationId: string | null; organization: { name: string } | null }) => ({
          id: u.id, name: u.name, organizationId: u.organizationId, organizationName: u.organization?.name || null,
        })),
        developers: developers.map((u) => ({ id: u.id, name: u.name, role: u.role })),
        organizations: organizations.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })),
        assignableUsers: [
          ...developers.map((u) => ({ id: u.id, name: u.name, role: u.role })),
          ...submitters.map((u: { id: string; name: string; organizationId: string | null }) => ({ id: u.id, name: u.name, role: "subsidiary" as const, organizationId: u.organizationId })),
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
