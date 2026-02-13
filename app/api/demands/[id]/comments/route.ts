import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id } = await params
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "留言內容不能為空" }, { status: 400 })
    }

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const comment = await prisma.demandComment.create({
      data: {
        demandId: id,
        userId: auth.userId,
        content: content.trim(),
      },
      include: { user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Add comment error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
