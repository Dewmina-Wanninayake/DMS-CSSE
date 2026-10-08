/** `P-2026-007` — stable identifier shared by every version of one policy. */
export function formatPolicyKey(year: number, sequence: number): string {
  return `P-${year}-${String(sequence).padStart(3, '0')}`;
}

/** `S-2026-0012` — shown on the simulation result screen as the simulation id. */
export function formatSimulationReference(year: number, id: number): string {
  return `S-${year}-${String(id).padStart(4, '0')}`;
}
