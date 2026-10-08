import { z } from 'zod';
import {
  HazardType,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  POLICY_LIMITS,
  PolicyStatus,
} from '@dms/shared';
import { parseDay } from '../domain/period';

const id = z.coerce.number().int().positive();
const day = z
  .string()
  .refine((value) => parseDay(value) !== null, 'Use a real calendar date in YYYY-MM-DD format.');
const hazardType = z.enum(HazardType);

export const idParams = z.object({ id });
export const hazardParams = z.object({ hazardType });

export const trendReportBody = z.object({
  hazardType,
  districtIds: z.union([
    z.literal('all'),
    z.array(id).min(1, 'Select at least one district.').max(25),
  ]),
  periodStart: day,
  periodEnd: day,
});

export const latestReportsQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(POLICY_LIMITS.latestReportsMax)
    .default(POLICY_LIMITS.latestReportsDefault),
});

const text = (max: number) => z.string().max(max, `Use at most ${max} characters.`).default('');

const content = {
  title: z
    .string()
    .trim()
    .min(POLICY_LIMITS.titleMin, `The title needs at least ${POLICY_LIMITS.titleMin} characters.`)
    .max(
      POLICY_LIMITS.titleMax,
      `The title can have at most ${POLICY_LIMITS.titleMax} characters.`,
    ),
  description: text(POLICY_LIMITS.descriptionMax),
  mitigationStrategies: text(POLICY_LIMITS.sectionMax),
  landUseGuidelines: text(POLICY_LIMITS.sectionMax),
  resourceRules: text(POLICY_LIMITS.sectionMax),
  warningRiskThreshold: z.number().positive().max(10_000).nullable().default(null),
  proposedEffectiveDate: day.nullable().default(null),
};

export const policyContentBody = z.object(content);

const draftShape = { ...content, trendReportId: id, clientId: z.uuid().optional() };

export const policyDraftBody = z.object(draftShape);

export const syncBody = z.object({
  drafts: z
    .array(z.object({ ...draftShape, clientId: z.uuid() }))
    .min(1)
    .max(50),
});

export const policyListQuery = z.object({
  status: z.enum(PolicyStatus).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const simulationBody = z.object({
  intensity: z.number().int().min(POLICY_LIMITS.intensityMin).max(POLICY_LIMITS.intensityMax),
  teamsDeployed: z.number().int().min(1, 'Deploy at least one team.').max(1000),
  sheltersActivated: z.number().int().min(0).max(1000),
});

export const reviewBody = z
  .object({
    decision: z.enum(['Approved', 'Rejected']),
    comments: z.string().trim().max(POLICY_LIMITS.commentsMax).default(''),
    effectiveDate: day.optional(),
  })
  .refine((v) => v.decision === 'Approved' || v.comments.length >= POLICY_LIMITS.commentsMin, {
    path: ['comments'],
    message: `Explain the rejection in at least ${POLICY_LIMITS.commentsMin} characters.`,
  });

export const settingsBody = z.object({
  riskThreshold: z.number().positive().max(10_000),
  mediumRatio: z.number().gt(0).lt(1),
  minDataPoints: z.number().int().min(1).max(1000),
});
