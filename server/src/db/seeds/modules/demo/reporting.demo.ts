import type { DemoApi, DemoSummary, DemoUser, Json } from './demo-api';

/** Fixed UUID of the first demo report; its presence means the demo data was already created. */
export const FIRST_DEMO_REPORT_ID = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

/**
 * UC-CV-003 and UC-DIST-02: ground reports in every state (Pending, Verified, Rejected, needs
 * information, linked duplicate), warnings at every stage, and a volunteer's field update.
 */
export async function seedReportingAndVerification(api: DemoApi, summary: DemoSummary) {
  const { as, district, hoursAgo } = api;
  const citizen = as('citizen@dms.lk');
  const citizen2 = as('citizen2@dms.lk');
  const volunteer = as('volunteer@dms.lk');
  const officer = as('officer@dms.lk');
  const approver = as('approver@dms.lk');

  // ---- UC-CV-003: reports in every state ------------------------------------------------------
  const report = async (
    who: DemoUser,
    code: string,
    hazardType: string,
    description: string,
    hoursBack: number,
    options: { photo?: boolean; clientId?: string; offsetDeg?: number } = {},
  ) => {
    const where = district(code);
    const created = await who.post('/reports', {
      clientId: options.clientId,
      hazardType,
      description,
      latitude: where.latitude + (options.offsetDeg ?? 0),
      longitude: where.longitude,
      locationSource: 'Gps',
      reportedAt: hoursAgo(hoursBack),
    });
    if (options.photo) await who.photo(created.id);
    summary.reports += 1;
    return created.id;
  };
  const decide = (id: number, body: Json) =>
    officer.post(`/verification/reports/${id}/decision`, body);
  const warn = async (
    reportId: number,
    level: string,
    codes: string[],
    reason: string,
    channels: string[],
  ) => {
    const warning = await officer.post('/warnings', {
      reportId,
      level,
      areaIds: codes.map((code) => district(code).id),
      reason,
      language: 'English',
      channels,
      confirmedAudience: true,
    });
    summary.warnings += 1;
    return warning;
  };

  // Verified on GPS + photo, then a Warning that a Second Approver has approved and that was delivered.
  const kegalleFlood = await report(
    citizen,
    'KEG',
    'Flood',
    'Kelani river has risen over the low bridge and is entering houses.',
    5,
    {
      photo: true,
      clientId: FIRST_DEMO_REPORT_ID,
    },
  );
  await decide(kegalleFlood, {
    decision: 'Verified',
    severity: 'High',
    notes: 'Photo and GPS match the Kegalle gauge, which is above the danger mark.',
  });
  const issued = await warn(
    kegalleFlood,
    'Warning',
    ['KEG', 'RAT'],
    'River level above the danger mark; residents near the Kelani and Kalu banks should move to higher ground.',
    ['Push', 'SMS', 'AudibleAlert'],
  );
  await approver.post(`/warnings/${issued.id}/approval`, {
    decision: 'Approved',
    notes: 'Gauge readings confirm the threat.',
  });

  // Verified landslide, a Watch (no approval needed) that the officer later lowers.
  const landslide = await report(
    citizen,
    'NWE',
    'Landslide',
    'Soil slip has blocked the estate road above the tea factory.',
    4,
    { photo: true },
  );
  await decide(landslide, {
    decision: 'Verified',
    severity: 'Medium',
    notes: 'Photo shows a fresh slip on a steep slope.',
  });
  const watch = await warn(
    landslide,
    'Watch',
    ['NWE'],
    'Slope instability after heavy rain; avoid the estate road.',
    ['Push', 'SMS'],
  );
  await officer.post(`/warnings/${watch.id}/correction`, {
    action: 'Correct',
    level: 'Advisory',
    reason: 'Rainfall has eased and the slope has been inspected.',
  });

  // A critical flood whose Emergency warning is still waiting for a Second Approver.
  const gampaha = await report(
    citizen,
    'GPH',
    'Flood',
    'Water is rising fast in the Attanagalu basin and the canal has overflowed.',
    3,
    { photo: true },
  );
  await decide(gampaha, {
    decision: 'Verified',
    severity: 'Critical',
    notes: 'Photo and sensor reading agree; Gampaha shelter is already full.',
  });
  await warn(
    gampaha,
    'Emergency',
    ['GPH'],
    'Attanagalu basin is flooding; evacuate low-lying areas now.',
    ['Push', 'SMS', 'AudibleAlert'],
  );

  // Two people report the same blocked road: the second is linked as a duplicate automatically, and the
  // first is verified on corroboration alone (no photo).
  const road = await report(
    citizen,
    'KDY',
    'BlockedRoad',
    'A fallen tree is blocking both lanes near the Peradeniya junction.',
    2,
  );
  await report(
    citizen2,
    'KDY',
    'BlockedRoad',
    'Tree across the road at Peradeniya, buses are turning back.',
    1.7,
    { offsetDeg: 0.0004 },
  );
  await decide(road, {
    decision: 'Verified',
    severity: 'Low',
    notes: 'Corroborated by a second report from the same junction.',
  });

  // The officer's queue and the citizen's "needs information" and "rejected" states.
  await report(
    citizen,
    'RAT',
    'Flood',
    'Kalu river is at the top of the bank near the Ratnapura bridge.',
    1.5,
    { photo: true },
  );
  await report(
    citizen2,
    'KLT',
    'Landslide',
    'Cracks across the hillside road above the temple.',
    1,
  );
  const unclear = await report(citizen, 'CMB', 'Flood', 'Water on the road.', 6);
  await decide(unclear, {
    decision: 'RequiresInformation',
    notes: 'Which road is this, and how deep is the water? A photo would help.',
  });
  const notHazard = await report(citizen2, 'CMB', 'Other', 'Strange smell near the canal.', 7);
  await decide(notHazard, {
    decision: 'Rejected',
    notes: 'Not a natural hazard; passed to the public health office.',
  });

  // A volunteer certified for Ratnapura adds a field update to a citizen's report.
  const ratnapuraReport = await report(
    volunteer,
    'RAT',
    'Flood',
    'Volunteer check: Kalu river is 20 cm below the bridge deck.',
    1.2,
    { photo: true },
  );
  await volunteer.post(`/reports/${ratnapuraReport}/field-updates`, {
    note: 'Water is still rising about 5 cm every half hour.',
  });
}
