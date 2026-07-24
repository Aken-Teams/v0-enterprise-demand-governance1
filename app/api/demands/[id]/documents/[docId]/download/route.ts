import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { watermarkPdf, textToPdf, markdownToPdf, imageToPdf, officeToPdf, coverPagePdf } from "@/lib/pdf-watermark"

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || ""
}

function formatTaipeiTime(date: Date): string {
  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const auth = verifyAuth(request)
    const { id, docId } = await params

    // Look up user for watermark text
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, email: true },
    })

    const doc = await prisma.demandDocument.findFirst({
      where: { id: docId, demandId: id },
    })
    if (!doc) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    }

    // 報價單：僅強合管理者可下載，且須已審核通過（其他人只能檢視）
    if (doc.type === "ZHIHE_QUOTE") {
      const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { managerCompany: true } })
      if (auth.role !== "admin" || me?.managerCompany !== "QIANGHE") {
        return NextResponse.json({ error: "僅強合管理者可下載報價單" }, { status: 403 })
      }
      const dem = await prisma.demand.findUnique({ where: { id }, select: { quoteReviewedAt: true } })
      if (!dem?.quoteReviewedAt) {
        return NextResponse.json({ error: "報價單尚未審核通過，無法下載" }, { status: 403 })
      }
    }

    // View-only admins cannot download
    if (auth.role === "admin") {
      const demand = await prisma.demand.findUnique({
        where: { id },
        select: { id: true, organizationId: true },
      })
      if (demand) {
        const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
          id: demand.id, organizationId: demand.organizationId,
        })
        if (!canWrite) {
          return NextResponse.json({ error: "觀看權限無法下載文件" }, { status: 403 })
        }
      }
    }

    // External URL documents cannot be watermarked
    if (!doc.fileUrl || doc.fileUrl.startsWith("http")) {
      return NextResponse.json({ error: "外部連結無法下載為 PDF" }, { status: 400 })
    }

    const watermarkText = `${user?.name || auth.email} | ${formatTaipeiTime(new Date())}`

    // Resolve file path on disk
    const filePath = path.join(
      process.cwd(),
      "uploads",
      "demands",
      id,
      path.basename(doc.fileUrl),
    )

    let fileBytes: Buffer
    try {
      fileBytes = await readFile(filePath)
    } catch {
      return NextResponse.json({ error: "檔案不存在" }, { status: 404 })
    }

    const ext = getFileExtension(doc.fileName)
    let pdfBytes: Uint8Array

    switch (ext) {
      case "pdf":
        pdfBytes = await watermarkPdf(fileBytes, watermarkText)
        break

      case "md":
        pdfBytes = await markdownToPdf(
          fileBytes.toString("utf-8"),
          watermarkText,
          doc.fileName,
        )
        break

      case "txt":
        pdfBytes = await textToPdf(
          fileBytes.toString("utf-8"),
          watermarkText,
          doc.fileName,
        )
        break

      case "jpg":
      case "jpeg":
        pdfBytes = await imageToPdf(fileBytes, "image/jpeg", watermarkText)
        break

      case "png":
        pdfBytes = await imageToPdf(fileBytes, "image/png", watermarkText)
        break

      case "doc":
      case "docx":
      case "xls":
      case "xlsx":
      case "ppt":
      case "pptx": {
        const converted = await officeToPdf(fileBytes, doc.fileName, watermarkText)
        pdfBytes = converted || (await coverPagePdf(doc.fileName, watermarkText))
        break
      }

      default:
        // Other formats: generate a cover page PDF
        pdfBytes = await coverPagePdf(doc.fileName, watermarkText)
        break
    }

    const pdfFileName = doc.fileName.replace(/\.[^.]+$/, ".pdf")

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(pdfFileName)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Download document error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
