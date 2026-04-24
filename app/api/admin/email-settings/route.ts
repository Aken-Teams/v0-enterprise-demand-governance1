import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

/**
 * GET /api/admin/email-settings
 * 取得所有組織的郵件設定
 * Query: ?orgId=xxx (optional, filter by org)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const orgId = request.nextUrl.searchParams.get("orgId")

    const settings = await prisma.emailSetting.findMany({
      where: orgId ? { organizationId: orgId } : undefined,
      include: {
        organization: { select: { id: true, code: true, name: true } },
      },
      orderBy: { organization: { name: "asc" } },
    })

    // Also return all active orgs so the UI can show orgs without settings
    const organizations = await prisma.organization.findMany({
      where: { status: "active" },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ settings, organizations })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("GET /api/admin/email-settings error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

/**
 * PUT /api/admin/email-settings
 * Upsert 單一組織的郵件設定
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const body = await request.json()
    const { organizationId, signoffCcList, accountingEmail, reportSendDay } = body

    if (!organizationId) {
      return NextResponse.json({ error: "缺少 organizationId" }, { status: 400 })
    }

    // Validate reportSendDay
    const day = Number(reportSendDay) || 5
    if (day < 1 || day > 28) {
      return NextResponse.json({ error: "報表寄送日須為 1-28" }, { status: 400 })
    }

    // Validate email formats
    const ccList: string[] = Array.isArray(signoffCcList) ? signoffCcList : []
    for (const email of ccList) {
      if (email && !email.includes("@")) {
        return NextResponse.json({ error: `CC Email 格式不正確: ${email}` }, { status: 400 })
      }
    }
    if (accountingEmail && !accountingEmail.includes("@")) {
      return NextResponse.json({ error: "會計 Email 格式不正確" }, { status: 400 })
    }

    const setting = await prisma.emailSetting.upsert({
      where: { organizationId },
      create: {
        organizationId,
        signoffCcList: JSON.stringify(ccList.filter(Boolean)),
        accountingEmail: accountingEmail || null,
        reportSendDay: day,
      },
      update: {
        signoffCcList: JSON.stringify(ccList.filter(Boolean)),
        accountingEmail: accountingEmail || null,
        reportSendDay: day,
      },
      include: {
        organization: { select: { id: true, code: true, name: true } },
      },
    })

    logAudit({
      userId: auth.userId,
      action: "UPDATE_EMAIL_SETTING",
      entity: "EMAIL_SETTING",
      entityId: setting.id,
      details: { organizationId, signoffCcList: ccList, accountingEmail, reportSendDay: day },
      request,
    })

    return NextResponse.json({ setting })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("PUT /api/admin/email-settings error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
