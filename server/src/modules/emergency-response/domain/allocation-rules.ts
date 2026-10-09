export type QuantityCheck =
  { ok: true } | { ok: false; reason: 'NOT_A_POSITIVE_INTEGER' | 'EXCEEDS_AVAILABLE' };

/** Validation rule: quantity > 0 and ≤ available (in the resource's own unit). */
export function checkAllocationQuantity(requested: number, available: number): QuantityCheck {
  if (!Number.isInteger(requested) || requested <= 0) {
    return { ok: false, reason: 'NOT_A_POSITIVE_INTEGER' };
  }
  if (requested > available) {
    return { ok: false, reason: 'EXCEEDS_AVAILABLE' };
  }
  return { ok: true };
}
