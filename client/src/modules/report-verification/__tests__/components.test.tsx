import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VerificationDecision, WarningLevel, type EvidenceAssessment } from '@dms/shared';
import { CorrectionModal } from '../components/CorrectionModal';
import { DecisionForm } from '../components/DecisionForm';
import { DecisionSupportCard } from '../components/DecisionSupportCard';
import { NearbyReportsList } from '../components/NearbyReportsList';

const sufficient: EvidenceAssessment = {
  sufficient: true,
  hasGps: true,
  hasPhoto: true,
  corroborationCount: 0,
  reasons: ['GPS location and photo meet the minimum evidence rule.'],
};
const insufficient: EvidenceAssessment = {
  sufficient: false,
  hasGps: false,
  hasPhoto: false,
  corroborationCount: 0,
  reasons: ['No photo was attached.'],
};

describe('DecisionForm (step 6)', () => {
  const setup = (evidence = sufficient, onSubmit = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <DecisionForm
        currentDecision={null}
        currentNotes={null}
        evidence={evidence}
        onSubmit={onSubmit}
      />,
    );
    return onSubmit;
  };

  it('should verify with a severity and send the notes', async () => {
    const onSubmit = setup();
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'High');
    await userEvent.type(screen.getByLabelText('Officer notes'), '  Matches gauge ');
    await userEvent.click(screen.getByRole('button', { name: /Save decision/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      decision: VerificationDecision.Verified,
      severity: 'High',
      notes: 'Matches gauge',
      duplicateOf: undefined,
    });
  });

  it('should refuse to verify when the minimum evidence rule is not met', async () => {
    const onSubmit = setup(insufficient);
    await userEvent.click(screen.getByRole('button', { name: /Save decision/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Minimum evidence rule is not satisfied',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['Rejected', 'Requires information'])('should require notes before %s', async (label) => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole('radio', { name: label }));
    expect(screen.queryByLabelText('Severity')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Save decision/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Notes are required');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('3a: should send the report number a duplicate is linked to, without a severity', async () => {
    const onSubmit = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Rejected' }));
    await userEvent.type(screen.getByLabelText('Officer notes'), 'Same as report 4');
    await userEvent.type(screen.getByLabelText('Duplicate of report number (optional)'), '4');
    await userEvent.click(screen.getByRole('button', { name: /Save decision/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      decision: VerificationDecision.Rejected,
      severity: undefined,
      notes: 'Same as report 4',
      duplicateOf: 4,
    });
  });

  it('should show why saving failed', async () => {
    setup(
      sufficient,
      vi.fn().mockRejectedValue(new Error('This report has already been decided.')),
    );
    await userEvent.click(screen.getByRole('button', { name: /Save decision/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already been decided');

    vi.clearAllMocks();
  });

  it('should show a generic message for an error without one', async () => {
    setup(sufficient, vi.fn().mockRejectedValue('nope'));
    await userEvent.click(screen.getByRole('button', { name: /Save decision/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to submit decision.');
  });

  it('should offer to escalate only once the report is verified', async () => {
    const onEscalate = vi.fn();
    const { rerender } = render(
      <DecisionForm
        currentDecision={null}
        currentNotes={null}
        evidence={sufficient}
        onSubmit={vi.fn()}
        onEscalateWarning={onEscalate}
      />,
    );
    expect(screen.queryByRole('button', { name: /Raise a warning/ })).not.toBeInTheDocument();
    rerender(
      <DecisionForm
        currentDecision={VerificationDecision.Verified}
        currentNotes="Seen"
        evidence={sufficient}
        onSubmit={vi.fn()}
        onEscalateWarning={onEscalate}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Raise a warning/ }));
    expect(onEscalate).toHaveBeenCalledOnce();
  });
});

describe('CorrectionModal (extension 14a)', () => {
  const setup = (onSubmit = vi.fn().mockResolvedValue(undefined), isOpen = true) => {
    const onClose = vi.fn();
    render(
      <CorrectionModal
        warningId={10}
        currentLevel={WarningLevel.Warning}
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
    return { onSubmit, onClose };
  };

  it('should render nothing while closed', () => {
    setup(undefined, false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should correct the level with a reason and close', async () => {
    const { onSubmit, onClose } = setup();
    expect(screen.getByLabelText(/New warning level/)).toHaveValue(WarningLevel.Warning);
    await userEvent.selectOptions(screen.getByLabelText(/New warning level/), 'AllClear');
    await userEvent.type(screen.getByLabelText('Reason for the correction'), ' Hazard has passed ');
    await userEvent.click(screen.getByRole('button', { name: 'Apply correction' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      action: 'Correct',
      level: 'AllClear',
      reason: 'Hazard has passed',
    });
  });

  it('should withdraw without a level or reason and warn that teams are told', async () => {
    const { onSubmit } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Withdraw warning' }));
    expect(screen.getByText(/will notify all relevant DMC emergency teams/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw warning' }));
    expect(onSubmit).toHaveBeenCalledWith({
      action: 'Withdraw',
      level: undefined,
      reason: undefined,
    });
  });

  it('should show the refusal when a Second Approver is needed, and stay open', async () => {
    const { onClose } = setup(
      vi
        .fn()
        .mockRejectedValue(
          new Error(
            'A Second Approver must confirm a correction or withdrawal of a Warning or Emergency.',
          ),
        ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply correction' }));
    expect(await screen.findByText(/Second Approver must confirm/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should fall back to a generic message and let the officer cancel', async () => {
    const { onClose } = setup(vi.fn().mockRejectedValue('x'));
    await userEvent.click(screen.getByRole('button', { name: 'Apply correction' }));
    expect(await screen.findByText('Correction failed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('NearbyReportsList (decision support, 2 km / 2 h)', () => {
  it('should say when no report is nearby', () => {
    render(<NearbyReportsList reports={[]} />);
    expect(screen.getByText(/No other ground hazard reports/)).toBeInTheDocument();
  });

  it('should list nearby reports with distance and a status label', () => {
    render(
      <NearbyReportsList
        reports={[
          {
            id: 2,
            hazardType: 'Flood',
            districtName: 'Colombo',
            reportedAt: '2026-10-09T10:30:00.000Z',
            distanceKm: 0.4,
            status: 'Verified',
          },
          {
            id: 3,
            hazardType: 'Flood',
            districtName: 'Colombo',
            reportedAt: '2026-10-09T10:40:00.000Z',
            distanceKm: 1.1,
            status: 'Rejected',
          },
          {
            id: 4,
            hazardType: 'Landslide',
            districtName: 'Colombo',
            reportedAt: '2026-10-09T10:50:00.000Z',
            distanceKm: 1.9,
            status: 'Pending',
          },
        ]}
      />,
    );
    expect(screen.getByText('Nearby reports (3)')).toBeInTheDocument();
    expect(screen.getByText('0.4 km')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('DecisionSupportCard', () => {
  it('should show the evidence verdict, the sensor reading and the active criteria', () => {
    render(
      <DecisionSupportCard
        evidence={sufficient}
        sensor={{
          stationName: 'Kelani River',
          observedAt: '2026-10-09T10:15:00.000Z',
          rainfallMm: 45,
          riverLevelM: 5.2,
        }}
        criteria={
          {
            hazardType: 'Flood',
            riskThreshold: 8,
            mediumRatio: 0.5,
            sourcePolicyKey: 'P-2026-001',
          } as never
        }
      />,
    );
    expect(screen.getByText('Sufficient evidence')).toBeInTheDocument();
    expect(screen.getByText('Hydromet Sensor (Kelani River)')).toBeInTheDocument();
    expect(screen.getByText(/Risk Threshold: 8/)).toHaveTextContent('P-2026-001');
  });

  it('should explain missing evidence and a missing sensor, and name the default criteria', () => {
    render(
      <DecisionSupportCard
        evidence={insufficient}
        sensor={null}
        criteria={
          {
            hazardType: 'Flood',
            riskThreshold: 5,
            mediumRatio: 0.5,
            sourcePolicyKey: null,
          } as never
        }
      />,
    );
    expect(screen.getByText('Insufficient evidence')).toBeInTheDocument();
    expect(screen.getByText('No photo was attached.')).toBeInTheDocument();
    expect(screen.getByText(/No recent hydromet station sensor readings/)).toBeInTheDocument();
    expect(screen.getByText(/Default standard/)).toBeInTheDocument();
  });
});
