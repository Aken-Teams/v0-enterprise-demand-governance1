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

export const updateDemandSchema = z.object({
  title: z.string().min(1, "請輸入需求標題").max(200, "標題不得超過200字"),
  organizationId: z.string().optional(),
  submitterId: z.string().optional(),
  description: z.string().min(1, "請輸入需求說明"),
  painPoint: z.string().min(1, "請輸入痛點說明"),
  expectedBenefit: z.string().optional().default(""),
  estimatedSp: z.coerce
    .number({ invalid_type_error: "SP 估點必須為數字" })
    .int("SP 估點必須為整數")
    .min(1, "SP 估點至少為 1"),
  desiredDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val + "T12:00:00Z") : null)),
  adminNotes: z.string().optional().default(""),
})

export type UpdateDemandInput = z.infer<typeof updateDemandSchema>
