/**
 * Test script for mail API
 * Usage: npx tsx scripts/test-mail.ts
 */
import "dotenv/config"

const MAIL_BASE_URL = process.env.AD_URL || "http://220.130.234.188:9998"
const MAIL_API_KEY = process.env.AD_API || ""

async function main() {
  console.log("Mail API URL:", MAIL_BASE_URL)
  console.log("API Key:", MAIL_API_KEY.slice(0, 8) + "...")

  // Test 1: Plain text email
  console.log("\n--- Test 1: Plain text email ---")
  try {
    const res = await fetch(`${MAIL_BASE_URL}/ldap/api/v1/mail/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": MAIL_API_KEY,
      },
      body: JSON.stringify({
        to: ["test3@panjit.com.tw"],
        subject: "[測試] 需求治理系統 - 郵件功能測試",
        body: "這是一封來自需求治理系統的測試郵件。\n\n如果您收到此信，表示郵件功能正常運作。\n\n此為系統測試信，請忽略。",
      }),
    })

    const data = await res.json()
    console.log("Status:", res.status)
    console.log("Response:", JSON.stringify(data, null, 2))
  } catch (err) {
    console.error("Error:", err)
  }

  // Test 2: HTML email
  console.log("\n--- Test 2: HTML email ---")
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">需求治理系統</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>您好，</p>
          <p>這是一封 <strong>HTML 格式</strong>的測試郵件。</p>
          <p>以下是測試連結：</p>
          <a href="https://example.com" style="display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none;">
            查看需求詳情
          </a>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">此為系統測試信，請忽略。</p>
        </div>
      </div>
    `

    const res = await fetch(`${MAIL_BASE_URL}/ldap/api/v1/mail/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": MAIL_API_KEY,
      },
      body: JSON.stringify({
        to: ["test3@panjit.com.tw"],
        subject: "[測試] 需求治理系統 - HTML 郵件測試",
        body: html,
        body_type: "html",
      }),
    })

    const data = await res.json()
    console.log("Status:", res.status)
    console.log("Response:", JSON.stringify(data, null, 2))
  } catch (err) {
    console.error("Error:", err)
  }
}

main()
