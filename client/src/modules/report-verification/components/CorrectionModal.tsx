import { useState } from 'react';
import { CorrectionAction, WarningLevel, type CorrectionRequest } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Select, Textarea } from '../../../shared/ui/fields';

interface Props {
  warningId: number;
  currentLevel: WarningLevel;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CorrectionRequest) => Promise<void>;
}

export function CorrectionModal({ warningId, currentLevel, isOpen, onClose, onSubmit }: Props) {
  const [action, setAction] = useState<CorrectionAction>(CorrectionAction.Correct);
  const [level, setLevel] = useState<WarningLevel>(currentLevel);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        action,
        level: action === CorrectionAction.Correct ? level : undefined,
        reason: action === CorrectionAction.Correct ? reason.trim() || undefined : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Correction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="dialog">
        <h2 id="modal-title" style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-title)', fontWeight: 600 }}>
          Correct or Withdraw Warning #{warningId}
        </h2>

        {error && <div className="alert alert--danger" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <fieldset className="fieldset">
            <legend style={{ marginBottom: 'var(--space-2)' }}>Action Type</legend>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <label className="choice">
                <input
                  type="radio"
                  name="action"
                  value={CorrectionAction.Correct}
                  checked={action === CorrectionAction.Correct}
                  onChange={() => setAction(CorrectionAction.Correct)}
                />
                <span>Correct / Adjust Level (DIST-02 #8)</span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="action"
                  value={CorrectionAction.Withdraw}
                  checked={action === CorrectionAction.Withdraw}
                  onChange={() => setAction(CorrectionAction.Withdraw)}
                />
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Withdraw Warning</span>
              </label>
            </div>
          </fieldset>

          {action === CorrectionAction.Correct && (
            <>
              <Select
                label="Updated Warning Level (supports downgrading to AllClear)"
                value={level}
                onChange={(e) => setLevel(e.target.value as WarningLevel)}
                options={[
                  { value: WarningLevel.Advisory, label: 'Advisory' },
                  { value: WarningLevel.Watch, label: 'Watch' },
                  { value: WarningLevel.Warning, label: 'Warning' },
                  { value: WarningLevel.Emergency, label: 'Emergency' },
                  { value: WarningLevel.AllClear, label: 'AllClear (Downgrade/Clear)' },
                ]}
              />

              <Textarea
                label="Correction Reason / Update Notes"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain reason for correcting warning level or area..."
                rows={3}
              />
            </>
          )}

          {action === CorrectionAction.Withdraw && (
            <div className="alert alert--danger" style={{ fontSize: 'var(--text-caption)' }}>
              Withdrawing this warning will notify all relevant DMC emergency teams that the alert has been cancelled.
            </div>
          )}

          <div className="dialog__actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={action === CorrectionAction.Withdraw ? 'danger' : 'primary'} loading={isSubmitting}>
              {action === CorrectionAction.Withdraw ? 'Withdraw Warning' : 'Apply Correction'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
