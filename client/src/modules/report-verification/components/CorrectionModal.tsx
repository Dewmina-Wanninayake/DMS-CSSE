import { useState } from 'react';
import { CorrectionAction, WarningLevel, type CorrectionRequest } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Select, TextArea } from '../../../shared/ui/fields';

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
        <h2 id="modal-title" className="text-title strong mb-4 flush-top">
          Correct or withdraw warning #{warningId}
        </h2>

        {error && <div className="alert alert--danger mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="stack">
          <fieldset className="fieldset">
            <legend className="legend-gap">Action type</legend>
            <div className="row row--loose">
              <label className="choice">
                <input
                  type="radio"
                  name="action"
                  value={CorrectionAction.Correct}
                  checked={action === CorrectionAction.Correct}
                  onChange={() => setAction(CorrectionAction.Correct)}
                />
                <span>Correct or lower the level</span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="action"
                  value={CorrectionAction.Withdraw}
                  checked={action === CorrectionAction.Withdraw}
                  onChange={() => setAction(CorrectionAction.Withdraw)}
                />
                <span className="text-danger strong">Withdraw warning</span>
              </label>
            </div>
          </fieldset>

          {action === CorrectionAction.Correct && (
            <>
              <Select
                label="New warning level (can be lowered to AllClear)"
                value={level}
                onChange={(e) => setLevel(e.target.value as WarningLevel)}
              >
                <option value={WarningLevel.Advisory}>Advisory</option>
                <option value={WarningLevel.Watch}>Watch</option>
                <option value={WarningLevel.Warning}>Warning</option>
                <option value={WarningLevel.Emergency}>Emergency</option>
                <option value={WarningLevel.AllClear}>AllClear (lower or clear)</option>
              </Select>

              <TextArea
                label="Reason for the correction"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain reason for correcting warning level or area..."
                rows={3}
              />
            </>
          )}

          {action === CorrectionAction.Withdraw && (
            <div className="alert alert--danger caption">
              Withdrawing this warning will notify all relevant DMC emergency teams that the alert
              has been cancelled.
            </div>
          )}

          <div className="dialog__actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action === CorrectionAction.Withdraw ? 'danger' : 'primary'}
              loading={isSubmitting}
            >
              {action === CorrectionAction.Withdraw ? 'Withdraw warning' : 'Apply correction'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
