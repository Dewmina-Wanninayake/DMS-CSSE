import { describe, expect, it } from 'vitest';
import { PolicyStatus, type PolicyContentInput } from '@dms/shared';
import { InvalidStateError, ValidationError } from '../../../core/http/errors';
import { formatPolicyKey, formatSimulationReference } from '../domain/identifiers';
import { assertTransition, canTransition, isEditable } from '../domain/policy-state-machine';
import {
  findRegulatoryConflicts,
  type RegulatoryRule,
} from '../domain/regulatory-conflict-checker';
import { assertSubmittable } from '../domain/submission-rules';

const TODAY = '2026-10-09';

const content = (overrides: Partial<PolicyContentInput> = {}): PolicyContentInput => ({
  title: 'National Flood Mitigation Act',
  description: 'Reduce flood losses in the Kelani basin.',
  mitigationStrategies: 'Deploy early alerts.',
  landUseGuidelines: '',
  resourceRules: '',
  warningRiskThreshold: null,
  proposedEffectiveDate: null,
  ...overrides,
});

describe('policy state machine (DA #1)', () => {
  it.each([
    [PolicyStatus.Draft, PolicyStatus.PendingApproval],
    [PolicyStatus.PendingApproval, PolicyStatus.Approved],
    [PolicyStatus.PendingApproval, PolicyStatus.Rejected],
  ])('should allow %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    [PolicyStatus.Draft, PolicyStatus.Approved],
    [PolicyStatus.Draft, PolicyStatus.Rejected],
    [PolicyStatus.PendingApproval, PolicyStatus.Draft],
    [PolicyStatus.Approved, PolicyStatus.Rejected],
    [PolicyStatus.Rejected, PolicyStatus.Draft],
    [PolicyStatus.Rejected, PolicyStatus.PendingApproval],
  ])('should refuse %s → %s with a 409 error', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(InvalidStateError);
  });

  it('should only let a Draft be edited', () => {
    expect(isEditable(PolicyStatus.Draft)).toBe(true);
    expect(isEditable(PolicyStatus.PendingApproval)).toBe(false);
    expect(isEditable(PolicyStatus.Rejected)).toBe(false);
  });
});

describe('findRegulatoryConflicts (extension 8a)', () => {
  const rules: RegulatoryRule[] = [
    {
      code: 'REG-A',
      description: 'No building in river reserves.',
      forbiddenPhrases: ['construction within river reserve'],
    },
    {
      code: 'REG-B',
      description: 'Evacuations cannot be waived.',
      forbiddenPhrases: ['waive mandatory evacuation'],
    },
  ];

  it('should return no conflicts for a compliant policy', () => {
    expect(findRegulatoryConflicts(content(), rules)).toEqual([]);
  });

  it('should flag the clause, field and rule that conflict', () => {
    const conflicts = findRegulatoryConflicts(
      content({
        landUseGuidelines:
          'Keep areas clear. Allow Construction   within river reserve for housing. Review yearly.',
      }),
      rules,
    );
    expect(conflicts).toEqual([
      {
        ruleCode: 'REG-A',
        field: 'landUseGuidelines',
        clause: 'Allow Construction within river reserve for housing.',
        message: 'No building in river reserves.',
      },
    ]);
  });

  it('should report conflicts in several fields and rules', () => {
    const conflicts = findRegulatoryConflicts(
      content({
        mitigationStrategies: 'We may waive mandatory evacuation in minor events',
        resourceRules: 'construction within river reserve is fine',
      }),
      rules,
    );
    expect(conflicts.map((c) => [c.ruleCode, c.field])).toEqual([
      ['REG-B', 'mitigationStrategies'],
      ['REG-A', 'resourceRules'],
    ]);
  });

  it('should report a rule once per field even if several phrases match', () => {
    const [rule] = rules as [RegulatoryRule];
    const twoPhrases = { ...rule, forbiddenPhrases: ['river reserve', 'construction'] };
    expect(
      findRegulatoryConflicts(content({ landUseGuidelines: 'construction in the river reserve' }), [
        twoPhrases,
      ]),
    ).toHaveLength(1);
  });

  it('should do nothing when there are no rules', () => {
    expect(findRegulatoryConflicts(content({ landUseGuidelines: 'anything' }), [])).toEqual([]);
  });
});

describe('assertSubmittable (step 9 format validation)', () => {
  it('should accept a description with one measure section', () => {
    expect(() => assertSubmittable(content(), TODAY)).not.toThrow();
  });

  it('should accept any single measure section', () => {
    expect(() =>
      assertSubmittable(
        content({ mitigationStrategies: '', resourceRules: 'Pre-position boats' }),
        TODAY,
      ),
    ).not.toThrow();
  });

  it('should reject a blank description', () => {
    expect(() => assertSubmittable(content({ description: '   ' }), TODAY)).toThrow(
      ValidationError,
    );
  });

  it('should reject a policy with no measures and name both problems', () => {
    try {
      assertSubmittable(content({ description: '', mitigationStrategies: ' ' }), TODAY);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ValidationError).details).toEqual([
        { field: 'description', message: expect.any(String) },
        { field: 'mitigationStrategies', message: expect.any(String) },
      ]);
    }
  });
});

describe('assertSubmittable proposed date', () => {
  it('should accept today and a future proposed date', () => {
    expect(() => assertSubmittable(content({ proposedEffectiveDate: TODAY }), TODAY)).not.toThrow();
    expect(() =>
      assertSubmittable(content({ proposedEffectiveDate: '2027-01-01' }), TODAY),
    ).not.toThrow();
  });

  it('should reject a proposed date in the past', () => {
    expect(() =>
      assertSubmittable(content({ proposedEffectiveDate: '2026-10-08' }), TODAY),
    ).toThrow(ValidationError);
  });
});

describe('identifiers', () => {
  it('should format policy keys and simulation references with zero padding', () => {
    expect(formatPolicyKey(2026, 7)).toBe('P-2026-007');
    expect(formatPolicyKey(2026, 1234)).toBe('P-2026-1234');
    expect(formatSimulationReference(2026, 12)).toBe('S-2026-0012');
  });
});
