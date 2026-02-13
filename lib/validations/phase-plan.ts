import { z } from "zod"

const PHASE_STATUSES = [
  "SUBMITTED",
  "PRD_REVIEW",
  "SP_REVIEW",
  "DEVELOPING",
  "ACCEPTANCE",
  "CLOSED",
] as const

export const upsertPhasePlanSchema = z.object({
  phase: z.enum(PHASE_STATUSES),
  plannedSp: z.coerce.number().min(0).nullable().optional(),
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
  engineerId: z.string().optional().nullable(),
  pmId: z.string().optional().nullable(),
})

export const batchUpsertPhasePlansSchema = z.object({
  phases: z.array(upsertPhasePlanSchema).min(1).max(6),
})

export type UpsertPhasePlanInput = z.infer<typeof upsertPhasePlanSchema>
