import { NextRequest, NextResponse } from "next/server"
import { unlink } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"

// DELETE: Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, docId } = await params

    const doc = await prisma.demandDocument.findFirst({
      where: { id: docId, demandId: id },
    })
    if (!doc) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    }

    // Delivery users can only delete documents they uploaded
    if (auth.role === "delivery" && doc.uploadedBy !== auth.userId) {
      return NextResponse.json({ error: "僅能刪除自己上傳的文件" }, { status: 403 })
    }

    // Delete physical file if it's a local upload (not an external URL)
    if (doc.fileUrl && !doc.fileUrl.startsWith("http")) {
      try {
        const filePath = path.join(process.cwd(), "uploads", "demands", id, path.basename(doc.fileUrl))
        await unlink(filePath)
      } catch {
        // File may already be deleted, ignore
      }
    }

    await prisma.demandDocument.delete({ where: { id: docId } })

    return NextResponse.json({ message: "文件已刪除" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete document error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
