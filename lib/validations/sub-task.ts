import { z } from "zod"

export const createSubTaskSchema = z.object({
  name: z.string().min(1, "請輸入任務名稱").max(100),
  plannedStart: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  plannedEnd: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  assigneeId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).default(0),
})

export const updateSubTaskSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plannedStart: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  plannedEnd: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  actualStart: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  actualEnd: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  assigneeId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).optional(),
})
