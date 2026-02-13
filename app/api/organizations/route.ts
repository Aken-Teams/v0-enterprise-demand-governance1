import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    verifyAuth(request)

    const organizations = await prisma.organization.findMany({
      where: { status: "active" },
      select: {
        id: true,
        code: true,
        name: true,
        users: {
          where: { isActive: true, role: "subsidiary" },
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ organizations })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Get organizations error:", error)
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500 }
    )
  }
}
