import { useState } from 'react';
import {
  Severity,
  VerificationDecision,
  VERIFICATION_LIMITS,
  type DecisionRequest,
  type EvidenceAssessment,
} from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Alert } from '../../../shared/ui/feedback';
import { Select, TextArea, TextInput } from '../../../shared/ui/fields';

interface Props {
  currentDecision: VerificationDecision | null;
  currentNotes: string | null;
  evidence: EvidenceAssessment;
  onSubmit: (data: DecisionRequest) => Promise<void>;
  onEscalateWarning?: () => void;
  isSubmitting?: boolean;
}

/**
 * Mirrors the server rules so the officer gets an instant message, but the server stays authoritative:
 * Verified needs the minimum evidence rule (DIST-02 #3); Rejected and RequiresInformation need notes.
 */
export function DecisionForm({
  currentDecision,
  currentNotes,
  evidence,
  onSubmit,
  onEscalateWarning,
  isSubmitting = false,
}: Props) {
  const [decision, setDecision] = useState<VerificationDecision>(
    currentDecision ?? VerificationDecision.Verified,
  );
  const [severity, setSeverity] = useState<Severity>(Severity.Medium);
  const [notes, setNotes] = useState<string>(currentNotes ?? '');
  const [duplicateOf, setDuplicateOf] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (decision === VerificationDecision.Verified && !evidence.sufficient) {
      setError(
        'Cannot verify: Minimum evidence rule is not satisfied (requires GPS+Photo or nearby corroboration).',
      );
      return;
    }

    if (
      (decision === VerificationDecision.Rejected ||
        decision === VerificationDecision.RequiresInformation) &&
      notes.trim().length < VERIFICATION_LIMITS.notesMin
    ) {
      setError(
        `Notes are required (minimum ${VERIFICATION_LIMITS.notesMin} characters) for rejection or information requests.`,
      );
      return;
    }

    try {
      await onSubmit({
        decision,
        severity: decision === VerificationDecision.Verified ? severity : undefined,
        notes: notes.trim() || undefined,
        duplicateOf: duplicateOf ? parseInt(duplicateOf, 10) : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision.');
    }
  };

  return (
    <Card title="Your decision">
      <form onSubmit={handleSubmit} className="stack">
        {error && <Alert tone="danger">{error}</Alert>}

        <fieldset className="fieldset">
          <legend className="legend-gap">Verification decision</legend>
          <div className="row row--loose">
            <label className="choice">
              <input
                type="radio"
                name="decision"
                value={VerificationDecision.Verified}
                checked={decision === VerificationDecision.Verified}
                onChange={() => setDecision(VerificationDecision.Verified)}
              />
              <span className="text-success strong">Verified</span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="decision"
                value={VerificationDecision.Rejected}
                checked={decision === VerificationDecision.Rejected}
                onChange={() => setDecision(VerificationDecision.Rejected)}
              />
              <span className="text-danger strong">Rejected</span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="decision"
                value={VerificationDecision.RequiresInformation}
                checked={decision === VerificationDecision.RequiresInformation}
                onChange={() => setDecision(VerificationDecision.RequiresInformation)}
              />
              <span className="text-warning strong">Requires information</span>
            </label>
          </div>
        </fieldset>

        {decision === VerificationDecision.Verified && (
          <Select
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            <option value={Severity.Low}>Low</option>
            <option value={Severity.Medium}>Medium</option>
            <option value={Severity.High}>High</option>
            <option value={Severity.Critical}>Critical</option>
          </Select>
        )}

        <TextArea
          label="Officer notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Provide verification reasoning, observations, or information requested from reporter..."
          rows={3}
        />

        <TextInput
          label="Duplicate of report number (optional)"
          type="number"
          value={duplicateOf}
          onChange={(e) => setDuplicateOf(e.target.value)}
          placeholder="Enter parent report ID if duplicate"
        />

        <div className="row">
          <Button type="submit" loading={isSubmitting}>
            Save decision and tell the reporter
          </Button>

          {currentDecision === VerificationDecision.Verified && onEscalateWarning && (
            <Button type="button" variant="secondary" onClick={onEscalateWarning}>
              Raise a warning
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
