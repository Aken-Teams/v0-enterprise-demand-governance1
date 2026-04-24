/**
 * Mail API wrapper
 * Uses the internal mail service at AD_URL with AD_API key.
 */

import { prisma } from "@/lib/prisma"

const MAIL_BASE_URL = process.env.AD_URL || "http://220.130.234.188:9998"
const MAIL_API_KEY = process.env.AD_API || ""

interface Attachment {
  filename: string
  /** Base64-encoded file content */
  content: string
}

export interface SendMailOptions {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  /** "html" for HTML emails, omit for plain text */
  bodyType?: "html" | "text"
  attachments?: Attachment[]
}

interface MailResponse {
  success?: boolean
  message?: string
  [key: string]: unknown
}

export async function sendMail(options: SendMailOptions): Promise<MailResponse> {
  const payload: Record<string, unknown> = {
    to: options.to,
    subject: options.subject,
    body: options.body,
  }

  if (options.cc && options.cc.length > 0) {
    payload.cc = options.cc
  }

  if (options.bodyType === "html") {
    payload.body_type = "html"
  }

  if (options.attachments && options.attachments.length > 0) {
    payload.attachments = options.attachments
  }

  const response = await fetch(`${MAIL_BASE_URL}/api/v1/mail/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": MAIL_API_KEY,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Mail API error ${response.status}: ${text}`)
  }

  return response.json()
}

// ----------------------------------------------------------------
// sendMailAndLog — wraps sendMail and records every attempt in MailLog
// ----------------------------------------------------------------

interface SendMailAndLogOptions extends SendMailOptions {
  type: "SIGNOFF_NOTIFY" | "MONTHLY_REPORT"
  demandId?: string | null
  sentById?: string | null
}

export async function sendMailAndLog(options: SendMailAndLogOptions): Promise<MailResponse> {
  const logBase = {
    type: options.type as "SIGNOFF_NOTIFY" | "MONTHLY_REPORT",
    toAddresses: JSON.stringify(options.to),
    ccAddresses: options.cc ? JSON.stringify(options.cc) : null,
    subject: options.subject,
    demandId: options.demandId ?? null,
    sentById: options.sentById ?? null,
  }

  try {
    const result = await sendMail(options)

    // Log success (fire-and-forget)
    prisma.mailLog.create({
      data: { ...logBase, status: "SUCCESS" },
    }).catch(console.error)

    return result
  } catch (error) {
    // Log failure (fire-and-forget)
    prisma.mailLog.create({
      data: {
        ...logBase,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    }).catch(console.error)

    throw error
  }
}
