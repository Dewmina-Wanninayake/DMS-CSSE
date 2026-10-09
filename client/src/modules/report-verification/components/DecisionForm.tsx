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
import { Select, Textarea, TextInput } from '../../../shared/ui/fields';

interface Props {
  currentDecision: VerificationDecision | null;
  currentNotes: string | null;
  evidence: EvidenceAssessment;
  onSubmit: (data: DecisionRequest) => Promise<void>;
  onEscalateWarning?: () => void;
  isSubmitting?: boolean;
}

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
      setError('Cannot verify: Minimum evidence rule is not satisfied (requires GPS+Photo or nearby corroboration).');
      return;
    }

    if (
      (decision === VerificationDecision.Rejected ||
        decision === VerificationDecision.RequiresInformation) &&
      notes.trim().length < VERIFICATION_LIMITS.notesMin
    ) {
      setError(`Notes are required (minimum ${VERIFICATION_LIMITS.notesMin} characters) for rejection or information requests.`);
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
    <Card title="Record Verification Decision">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && <Alert tone="danger">{error}</Alert>}

        <fieldset className="fieldset">
          <legend style={{ marginBottom: 'var(--space-2)' }}>Verification Decision</legend>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <label className="choice">
              <input
                type="radio"
                name="decision"
                value={VerificationDecision.Verified}
                checked={decision === VerificationDecision.Verified}
                onChange={() => setDecision(VerificationDecision.Verified)}
              />
              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Verified</span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="decision"
                value={VerificationDecision.Rejected}
                checked={decision === VerificationDecision.Rejected}
                onChange={() => setDecision(VerificationDecision.Rejected)}
              />
              <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>Rejected</span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="decision"
                value={VerificationDecision.RequiresInformation}
                checked={decision === VerificationDecision.RequiresInformation}
                onChange={() => setDecision(VerificationDecision.RequiresInformation)}
              />
              <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>Requires Information</span>
            </label>
          </div>
        </fieldset>

        {decision === VerificationDecision.Verified && (
          <Select
            label="Assigned Severity Level"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            options={[
              { value: Severity.Low, label: 'Low' },
              { value: Severity.Medium, label: 'Medium' },
              { value: Severity.High, label: 'High' },
              { value: Severity.Critical, label: 'Critical' },
            ]}
          />
        )}

        <Textarea
          label="Officer Notes / Justification"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Provide verification reasoning, observations, or information requested from reporter..."
          rows={3}
        />

        <TextInput
          label="Duplicate Of Report ID (Optional)"
          type="number"
          value={duplicateOf}
          onChange={(e) => setDuplicateOf(e.target.value)}
          placeholder="Enter parent report ID if duplicate"
        />

        <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
          <Button type="submit" loading={isSubmitting}>
            Save Decision & Notify Reporter
          </Button>

          {currentDecision === VerificationDecision.Verified && onEscalateWarning && (
            <Button type="button" variant="secondary" onClick={onEscalateWarning}>
              Escalate Warning & Broadcast
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
