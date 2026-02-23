import { NextRequest, NextResponse } from "next/server"
import { verifyAuth, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    logAudit({
      userId: auth.userId,
      action: "LOGOUT",
      entity: "USER",
      entityId: auth.userId,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: true })
  }
}
