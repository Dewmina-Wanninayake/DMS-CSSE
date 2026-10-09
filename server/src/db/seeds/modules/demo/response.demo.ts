import type { DemoApi, DemoSummary } from './demo-api';

/**
 * UC-JOINT-001: dispatches in every status, allocations to a shelter, a team and an area, a reversal,
 * a resupply request and a shelter redirect request.
 */
export async function seedResponseWorkflows(api: DemoApi, summary: DemoSummary) {
  const { as } = api;
  // ---- UC-JOINT-001: dispatches, allocations, reversal, resupply -----------------------------
  const joint = as('joint@dms.lk');
  const teamLead = (n: string) => as(n);
  const board = (await joint.get('/response/dashboard')) as unknown as {
    teams: { id: number; name: string }[];
    shelters: { id: number; name: string }[];
    resources: { id: number; name: string }[];
    areas: { id: number; name: string }[];
  };
  const idOf = (list: { id: number; name: string }[], text: string) => {
    const found = list.find((item) => item.name.includes(text));
    if (!found) throw new Error(`Demo seed: nothing named ${text}`);
    return found.id;
  };
  const alpha = idOf(board.teams, 'Alpha');
  const bravo = idOf(board.teams, 'Bravo');
  const charlie = idOf(board.teams, 'Charlie');

  const dispatch = async (
    teamId: number,
    location: string,
    priority: string,
    instructions: string,
  ) => {
    summary.dispatches += 1;
    return joint.post('/dispatches', { location, priority, teamId, instructions });
  };
  const onSite = await dispatch(
    alpha,
    'Kaduwela, Kelani river bank',
    'High',
    'Evacuate households within 100 m of the bank; boats are in the vehicle.',
  );
  await teamLead('teamlead@dms.lk').patch(`/dispatches/${onSite.id}/status`, {
    status: 'EnRoute',
  });
  await teamLead('teamlead@dms.lk').patch(`/dispatches/${onSite.id}/status`, {
    status: 'OnSite',
  });
  await dispatch(
    bravo,
    'Gampaha town centre',
    'Urgent',
    'Set up a pumping point at the bus stand and report water depth hourly.',
  );
  const finished = await dispatch(
    charlie,
    'Ratnapura bridge',
    'Normal',
    'Treat minor injuries at the bridge and hand over to the district hospital.',
  );
  for (const status of ['EnRoute', 'OnSite', 'Completed']) {
    await teamLead('teamlead3@dms.lk').patch(`/dispatches/${finished.id}/status`, { status });
  }
  const cancelled = await dispatch(
    charlie,
    'Kalutara temple road',
    'High',
    'Check the road for debris.',
  );
  await joint.post(`/dispatches/${cancelled.id}/cancel`, {
    reason: 'The road was cleared by the local council before the team left.',
  });

  const allocate = async (
    resource: string,
    quantity: number,
    destinationType: string,
    destinationId: number,
    instructions: string,
  ) => {
    summary.allocations += 1;
    return joint.post('/allocations', {
      resourceId: idOf(board.resources, resource),
      quantity,
      destinationType,
      destinationId,
      instructions,
    });
  };
  await allocate(
    'Drinking water',
    1200,
    'Shelter',
    idOf(board.shelters, 'Colombo Central'),
    'Deliver to the main hall.',
  );
  const wrong = await allocate('Rice', 300, 'Team', alpha, 'Rations for the evacuation crew.');
  await allocate(
    'Blankets',
    100,
    'Area',
    idOf(board.areas, 'Gampaha'),
    'For households moved to the school.',
  );
  await allocate(
    'First-aid kits',
    30,
    'Shelter',
    idOf(board.shelters, 'Kalutara'),
    'Shelter medical corner.',
  );
  await joint.post(`/allocations/${wrong.id}/reversal`, {
    reason: 'Entered against the wrong team; the rice is going to the Gampaha shelter.',
  });
  await joint.post('/resupply-requests', {
    resourceId: idOf(board.resources, 'First-aid kits'),
    quantity: 100,
    note: 'Only 10 kits left after the Kalutara delivery.',
  });
  await joint.post(`/shelters/${idOf(board.shelters, 'Gampaha')}/redirect-requests`, {
    note: 'Gampaha shelter is full; please redirect new arrivals to Kalutara.',
  });
}
