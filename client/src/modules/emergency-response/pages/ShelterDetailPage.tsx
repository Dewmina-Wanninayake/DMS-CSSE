import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { RedirectRequestResult } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { formatDate } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { TextArea } from '../../../shared/ui/fields';
import { Alert, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';
import { ShelterStateBadge } from '../components/badges';

/** Shelter detail (step 3, read only). A full shelter offers the redirect request (3a, JOINT #9). */
export function ShelterDetailPage() {
  const id = Number(useParams().id);
  const shelter = useAsync(() => emergencyResponseApi.shelter(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [result, setResult] = useState<RedirectRequestResult>();

  async function requestRedirect() {
    setBusy(true);
    setProblem(undefined);
    try {
      setResult(await emergencyResponseApi.requestRedirect(id, note.trim() || undefined));
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const data = shelter.data;
  return (
    <>
      <PageHeader title={data?.name ?? 'Shelter'} subtitle="Shelter detail" backTo="/response" />
      <div className="shell__content stack">
        {shelter.loading && <LoadingState label="Loading the shelter…" />}
        {shelter.error && (
          <ErrorState message={errorMessage(shelter.error)} onRetry={shelter.reload} />
        )}
        {data && (
          <>
            <Alert tone="info">
              Occupancy is recorded by the Shelter Coordinator. You can view it here but not change
              it.
            </Alert>
            <dl className="summary">
              <div className="summary__row">
                <dt>Address</dt>
                <dd>{data.address}</dd>
              </div>
              <div className="summary__row">
                <dt>Occupied</dt>
                <dd>
                  {data.occupied} of {data.capacity}
                </dd>
              </div>
              <div className="summary__row">
                <dt>Spaces available</dt>
                <dd>{data.available}</dd>
              </div>
              <div className="summary__row">
                <dt>Status</dt>
                <dd>
                  <ShelterStateBadge shelter={data} />
                </dd>
              </div>
              <div className="summary__row">
                <dt>Occupancy last updated</dt>
                <dd>{data.occupancyUpdatedAt ? formatDate(data.occupancyUpdatedAt) : 'Unknown'}</dd>
              </div>
            </dl>

            {data.available > 0 && (
              <div>
                <ButtonLink
                  to={`/response/allocate?destinationType=Shelter&destinationId=${data.id}`}
                >
                  Allocate supplies here
                </ButtonLink>
              </div>
            )}

            {data.available <= 0 && !result && (
              <Card title="This shelter is full">
                <div className="stack">
                  <p>
                    Ask the Shelter Coordinator to redirect people, or send teams and supplies to
                    another shelter.
                  </p>
                  <TextArea
                    label="Note for the Shelter Coordinator"
                    hint="Optional"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                  />
                  {problem && <Alert tone="danger">{problem}</Alert>}
                  <div>
                    <Button loading={busy} onClick={() => void requestRedirect()}>
                      Request redirect
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {result && (
              <Card title="Redirect requested">
                <div className="stack">
                  <Alert tone="success">The Shelter Coordinator has been notified.</Alert>
                  <h3>Other shelters with space</h3>
                  {result.alternatives.length === 0 ? (
                    <p className="muted">No other shelter has space right now.</p>
                  ) : (
                    <ul className="list" aria-label="Shelters with space">
                      {result.alternatives.map((alternative) => (
                        <li key={alternative.id}>
                          {alternative.name} · {alternative.available} spaces
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
