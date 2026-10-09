import { z } from 'zod';
import {
  ApprovalDecision,
  Channel,
  CorrectionAction,
  Language,
  Severity,
  VERIFICATION_LIMITS,
  VerificationDecision,
  WarningLevel,
} from '@dms/shared';

export const idParams = z.object({ id: z.coerce.number().int().positive() });

const notes = z
  .string()
  .trim()
  .max(VERIFICATION_LIMITS.notesMax, `Use at most ${VERIFICATION_LIMITS.notesMax} characters.`)
  .optional();

export const decisionBody = z.object({
  decision: z.enum(VerificationDecision),
  notes,
  severity: z.enum(Severity).optional(),
  duplicateOf: z.number().int().positive().nullable().optional(),
});

const areaIds = z.array(z.number().int().positive()).min(1, 'Select at least one area.');
const channels = z.array(z.enum(Channel)).min(1, 'Select at least one channel.');

export const previewBody = z.object({
  reportId: z.number().int().positive(),
  level: z.enum(WarningLevel),
  areaIds,
  language: z.enum(Language),
  channels,
});

export const createWarningBody = previewBody.extend({
  reason: z
    .string()
    .trim()
    .min(VERIFICATION_LIMITS.reasonMin, `Give a reason of at least ${VERIFICATION_LIMITS.reasonMin} characters.`)
    .max(VERIFICATION_LIMITS.reasonMax),
  confirmedAudience: z.boolean().optional(),
  clientId: z.uuid().optional(),
  pendingSync: z.boolean().optional(),
});

export const approvalBody = z.object({
  decision: z.enum(ApprovalDecision),
  notes,
});

export const correctionBody = z.object({
  action: z.enum(CorrectionAction),
  level: z.enum(WarningLevel).optional(),
  reason: z.string().trim().min(VERIFICATION_LIMITS.reasonMin).max(VERIFICATION_LIMITS.reasonMax).optional(),
  areaIds: areaIds.optional(),
});
