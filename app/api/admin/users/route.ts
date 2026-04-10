import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { logAudit } from "@/lib/audit"

const ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  delivery: "交付團隊",
  subsidiary: "需求單位",
  viewer: "董事會",
}

const VALID_ROLES = new Set(["admin", "delivery", "subsidiary", "viewer"])

export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const users = await prisma.user.findMany({
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { demandAccessGrants: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role] || u.role,
      isActive: u.isActive,
      organizationId: u.organizationId,
      organizationName: u.organization?.name || null,
      ldapUsername: u.ldapUsername,
      ldapDomain: u.ldapDomain,
      isOrgAccount: u.isOrgAccount,
      accessCount: u._count.demandAccessGrants,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }))

    const totalUsers = result.length
    const activeUsers = result.filter((u) => u.isActive).length
    const roleCounts: Record<string, number> = {}
    for (const u of result) {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1
    }

    return NextResponse.json({
      users: result,
      summary: { totalUsers, activeUsers, roleCounts },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin users error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    const body = await request.json()
    const { name, email, password, role, organizationId, ldapUsername, ldapDomain, isOrgAccount } = body

    if (!name || !email || !role) {
      return NextResponse.json({ error: "姓名、電子郵件、角色皆為必填" }, { status: 400 })
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ error: "無效的角色" }, { status: 400 })
    }

    // Password is required unless LDAP-bound
    if (!ldapUsername && !password) {
      return NextResponse.json({ error: "非 AD 帳號必須設定密碼" }, { status: 400 })
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "密碼至少需要 6 個字元" }, { status: 400 })
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : ""

    // Optional: demand access + signoff role assignments from Step 2
    const assignments: { demandId: string; signoffRole?: string }[] = body.assignments ?? []
    const VALID_SIGNOFF_ROLES = ["REQUESTER", "MANAGER", "BOARD", "OBSERVER"]
    for (const a of assignments) {
      if (a.signoffRole && !VALID_SIGNOFF_ROLES.includes(a.signoffRole)) {
        return NextResponse.json({ error: `不合法的審核角色: ${a.signoffRole}` }, { status: 400 })
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: role as "admin" | "delivery" | "subsidiary" | "viewer",
          organizationId: organizationId || null,
          ldapUsername: ldapUsername || null,
          ldapDomain: ldapDomain || null,
          isBoardMember: role === "viewer",
          isOrgAccount: !!isOrgAccount,
        },
        include: { organization: { select: { name: true } } },
      })

      // Create demand access + signoff role assignments
      if (assignments.length > 0) {
        await tx.demandAccess.createMany({
          data: assignments.map((a) => ({
            demandId: a.demandId,
            userId: created.id,
            grantedBy: auth.userId,
            signoffRole: (a.signoffRole || "OBSERVER") as "REQUESTER" | "MANAGER" | "BOARD" | "OBSERVER",
          })),
        })
      }

      return created
    })

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "USER",
      entityId: user.id,
      details: {
        name,
        email,
        role,
        organization: user.organization?.name || null,
        assignmentCount: assignments.length,
      },
      request,
    })

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    // Prisma unique constraint violation
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "此電子郵件已被使用" }, { status: 409 })
    }
    console.error("Admin create user error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    const body = await request.json()
    const { id, name, email, role, isActive, organizationId, password, adminPassword, ldapUsername, ldapDomain, isOrgAccount } = body

    if (!id) {
      return NextResponse.json({ error: "缺少使用者 ID" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (role !== undefined) {
      data.role = role
      data.isBoardMember = role === "viewer"
    }
    if (isActive !== undefined) data.isActive = isActive
    if (organizationId !== undefined) data.organizationId = organizationId || null
    if (ldapUsername !== undefined) data.ldapUsername = ldapUsername || null
    if (ldapDomain !== undefined) data.ldapDomain = ldapDomain || null
    if (isOrgAccount !== undefined) data.isOrgAccount = !!isOrgAccount

    // Password reset — requires admin's own password for verification
    if (password && typeof password === "string" && password.length > 0) {
      if (password.length < 6) {
        return NextResponse.json({ error: "新密碼至少需要 6 個字元" }, { status: 400 })
      }
      if (!adminPassword) {
        return NextResponse.json({ error: "修改密碼需要輸入管理員密碼確認" }, { status: 400 })
      }
      const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { password: true } })
      if (!admin || !(await bcrypt.compare(adminPassword, admin.password))) {
        return NextResponse.json({ error: "管理員密碼驗證失敗" }, { status: 403 })
      }
      data.password = await bcrypt.hash(password, 10)
    }

    await prisma.user.update({ where: { id }, data })

    const changedFields = Object.keys(data).filter(k => k !== "password")
    logAudit({
      userId: auth.userId,
      action: "UPDATE",
      entity: "USER",
      entityId: id,
      details: { fields: changedFields, passwordChanged: "password" in data },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "此電子郵件已被使用" }, { status: 409 })
    }
    console.error("Admin update user error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "缺少使用者 ID" }, { status: 400 })
    }

    if (id === auth.userId) {
      return NextResponse.json({ error: "無法刪除自己的帳號" }, { status: 400 })
    }

    // Check if user is a submitter or creator of any demand (required fields, can't nullify)
    const demandAsSubmitter = await prisma.demand.findFirst({ where: { submitterId: id } })
    const demandAsCreator = await prisma.demand.findFirst({ where: { creatorId: id } })
    if (demandAsSubmitter || demandAsCreator) {
      return NextResponse.json({
        error: "此使用者為需求的提交者或建立者，無法刪除。建議改為停用帳號。",
      }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Nullify optional foreign keys pointing to this user
      await tx.demand.updateMany({ where: { managerId: id }, data: { managerId: null } })
      await tx.demand.updateMany({ where: { developerId: id }, data: { developerId: null } })
      await tx.demandPhasePlan.updateMany({ where: { engineerId: id }, data: { engineerId: null } })
      await tx.demandPhasePlan.updateMany({ where: { pmId: id }, data: { pmId: null } })
      await tx.demandSubTask.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } })

      // Delete owned records
      await tx.notification.deleteMany({ where: { userId: id } })
      await tx.demandComment.deleteMany({ where: { userId: id } })
      await tx.acceptanceRecord.deleteMany({ where: { reviewerId: id } })

      // Delete user
      await tx.user.delete({ where: { id } })
    })

    logAudit({
      userId: auth.userId,
      action: "DELETE",
      entity: "USER",
      entityId: id,
      details: { deletedUserId: id },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin delete user error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
