import { z } from "zod"

export const createDemandSchema = z.object({
  organizationId: z.string().min(1, "請選擇子公司"),
  title: z.string().min(1, "請輸入需求標題").max(200, "標題不得超過200字"),
  description: z.string().min(1, "請輸入需求說明"),
  painPoint: z.string().optional().default(""),
  expectedBenefit: z.string().optional().default(""),
  estimatedSp: z.coerce
    .number({ invalid_type_error: "SP 估點必須為數字" })
    .int("SP 估點必須為整數")
    .min(1, "SP 估點至少為 1"),
  desiredDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  adminNotes: z.string().optional().default(""),
})

export type CreateDemandInput = z.infer<typeof createDemandSchema>
