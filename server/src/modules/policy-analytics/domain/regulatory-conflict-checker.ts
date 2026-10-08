import type { PolicyContentInput, RegulatoryConflict } from '@dms/shared';

export interface RegulatoryRule {
  code: string;
  description: string;
  forbiddenPhrases: string[];
}

const CHECKED_FIELDS = [
  'description',
  'mitigationStrategies',
  'landUseGuidelines',
  'resourceRules',
] as const;

type CheckedContent = Pick<PolicyContentInput, (typeof CHECKED_FIELDS)[number]>;

/** The sentence containing the match, shortened for display. */
function clauseAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('.', index) + 1, 0);
  const endDot = text.indexOf('.', index);
  const end = endDot === -1 ? text.length : endDot + 1;
  return text.slice(start, end).trim().slice(0, 200);
}

/**
 * Extension 8a: flags clauses that contradict a national standard so the Analyst can fix them
 * before submission. Matching is case- and whitespace-insensitive; each rule is reported at most
 * once per field.
 */
export function findRegulatoryConflicts(
  content: CheckedContent,
  rules: RegulatoryRule[],
): RegulatoryConflict[] {
  const conflicts: RegulatoryConflict[] = [];
  for (const field of CHECKED_FIELDS) {
    // Collapsing whitespace keeps the index valid for both the original and the lower-cased copy.
    const original = content[field].replace(/\s+/g, ' ');
    const lowered = original.toLowerCase();
    for (const rule of rules) {
      const hit = rule.forbiddenPhrases
        .map((phrase) => lowered.indexOf(phrase.toLowerCase()))
        .find((index) => index !== -1);
      if (hit === undefined) continue;
      conflicts.push({
        ruleCode: rule.code,
        field,
        clause: clauseAround(original, hit),
        message: rule.description,
      });
    }
  }
  return conflicts;
}
