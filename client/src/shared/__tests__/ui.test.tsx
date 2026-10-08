import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Map } from 'lucide-react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BarChart } from '../ui/BarChart';
import { Button, ButtonLink } from '../ui/Button';
import { Card, ListItem, TileLink } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  StatusBadge,
} from '../ui/feedback';
import { Checkbox, Select, TextArea, TextInput } from '../ui/fields';
import { PageHeader } from '../ui/PageHeader';
import { StepProgress } from '../ui/StepProgress';

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Button', () => {
  it('should call onClick and default to type="button"', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('should block clicks and announce busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should render variants and a link styled as a button', () => {
    inRouter(
      <>
        <Button variant="danger">Delete</Button>
        <ButtonLink to="/x" variant="secondary" block>
          Go
        </ButtonLink>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn--danger');
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/x');
    expect(link).toHaveClass('btn--secondary', 'btn--block');
  });
});

describe('feedback components', () => {
  it('should announce errors with role=alert and other tones with role=status', () => {
    render(
      <>
        <Alert tone="danger" title="Failed">
          Could not save
        </Alert>
        <Alert tone="success">Saved</Alert>
        <OfflineBanner>Offline now</OfflineBanner>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toEqual([
      'Saved',
      'Offline now',
    ]);
  });

  it('should show text in status badges (not colour alone)', () => {
    render(<StatusBadge tone="warning">Pending approval</StatusBadge>);
    expect(screen.getByText('Pending approval')).toHaveClass('badge--warning');
  });

  it('should render loading, empty and error states with their actions', async () => {
    const retry = vi.fn();
    render(
      <>
        <LoadingState label="Loading things" />
        <EmptyState title="Nothing here" description="Add one" action={<button>Add</button>} />
        <ErrorState message="Server down" onRetry={retry} />
      </>,
    );
    expect(screen.getByText('Loading things')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Server down');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('should not show a retry button when none is provided', () => {
    render(<ErrorState message="x" />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('form fields', () => {
  it('should associate label, hint and error with the control', () => {
    render(
      <TextInput label="Title" hint="At least 5 characters" error="Too short" defaultValue="abc" />,
    );
    const input = screen.getByLabelText('Title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('error');
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
    expect(screen.getByText('At least 5 characters')).toBeInTheDocument();
  });

  it('should mark a valid field as not invalid and omit the error element', () => {
    render(<TextInput label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should support textarea, select and checkbox', async () => {
    const onChange = vi.fn();
    render(
      <>
        <TextArea label="Notes" defaultValue="hi" />
        <Select label="Kind" defaultValue="b" onChange={onChange}>
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
        <Checkbox label="Agree" />
      </>,
    );
    expect(screen.getByLabelText('Notes')).toHaveValue('hi');
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'a');
    expect(onChange).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('Agree'));
    expect(screen.getByLabelText('Agree')).toBeChecked();
  });
});

describe('StepProgress', () => {
  it('should state a true counter and expose progressbar semantics', () => {
    render(<StepProgress current={2} total={4} title="Measures" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 2 of 4: Measures');
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(bar.querySelectorAll('.steps__segment--done')).toHaveLength(2);
    expect(bar.querySelectorAll('.steps__segment')).toHaveLength(4);
  });
});

describe('ConfirmDialog', () => {
  it('should focus the safe button, confirm and cancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Sure?"
        confirmLabel="Yes, do it"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p>This has consequences.</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Sure?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, do it' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should cancel on Escape and disable the buttons while busy', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="Busy" confirmLabel="Go" busy onConfirm={() => {}} onCancel={onCancel}>
        body
      </ConfirmDialog>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    screen
      .getByRole('dialog')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should return focus to the opener when closed', async () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <ConfirmDialog
              title="T"
              confirmLabel="Ok"
              onConfirm={() => {}}
              onCancel={() => setOpen(false)}
            >
              x
            </ConfirmDialog>
          )}
        </>
      );
    };
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opener).toHaveFocus();
  });
});

describe('BarChart', () => {
  it('should describe every bar in text and scale to the largest value', () => {
    render(
      <BarChart
        title="Reports per month"
        unit="reports"
        primaryName="verified"
        secondaryName="historical"
        data={[
          { label: 'Jul', value: 2, secondary: 4 },
          { label: 'Aug', value: 8, secondary: 1 },
        ]}
      />,
    );
    const chart = screen.getByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Jul: verified 2 reports, historical 4');
    expect(chart.getAttribute('aria-label')).toContain('Aug: verified 8 reports, historical 1');
    const bars = chart.querySelectorAll<HTMLElement>('.chart__bar');
    expect(bars[2]?.style.height).toBe('100%'); // Aug verified = max
    expect(bars[0]?.style.height).toBe('25%');
  });

  it('should handle an empty data set', () => {
    render(<BarChart title="Empty" data={[]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('No data');
  });
});

describe('Card, tiles and list items', () => {
  it('should render a titled card with actions', () => {
    render(
      <Card title="Summary" actions={<button>Edit</button>}>
        content
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('should render a dashboard tile and list items as links or plain rows', () => {
    inRouter(
      <>
        <TileLink to="/analytics/map" icon={Map} label="Map view" value={3} />
        <ListItem icon={Map} title="Linked" subtitle="sub" to="/p/1" trailing="2h ago" />
        <ListItem icon={Map} title="Plain" tone="warning" />
      </>,
    );
    expect(screen.getByRole('link', { name: /Map view/ })).toHaveAttribute(
      'href',
      '/analytics/map',
    );
    expect(screen.getByRole('link', { name: /Linked/ })).toHaveAttribute('href', '/p/1');
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    expect(screen.getByText('Plain')).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('should show title, subtitle, back link and actions', () => {
    inRouter(
      <PageHeader
        title="High-risk zones"
        subtitle="Overlay view"
        backTo="/analytics"
        actions={<button>Act</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'High-risk zones' })).toBeInTheDocument();
    expect(screen.getByText('Overlay view')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', '/analytics');
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });

  it('should omit the back link when not requested', () => {
    inRouter(<PageHeader title="Home" />);
    expect(screen.queryByRole('link', { name: 'Go back' })).not.toBeInTheDocument();
  });
});
