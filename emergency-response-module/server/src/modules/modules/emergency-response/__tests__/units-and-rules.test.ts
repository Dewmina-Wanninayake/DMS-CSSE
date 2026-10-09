import { describe, expect, it } from 'vitest';
import { checkAllocationQuantity } from '../domain/allocation-rules';
import { formatQuantity, ResourceUnit } from '../domain/units';

describe('formatQuantity', () => {
  it('groups thousands and pluralises', () => {
    expect(formatQuantity(1200, ResourceUnit.Litre)).toBe('1,200 litres');
  });
  it('uses the singular for exactly one', () => {
    expect(formatQuantity(1, ResourceUnit.Box)).toBe('1 box');
  });
  it('keeps kg unchanged for any amount', () => {
    expect(formatQuantity(1, ResourceUnit.Kilogram)).toBe('1 kg');
    expect(formatQuantity(25, ResourceUnit.Kilogram)).toBe('25 kg');
  });
  it('formats zero as plural', () => {
    expect(formatQuantity(0, ResourceUnit.Piece)).toBe('0 pieces');
  });
});

describe('checkAllocationQuantity', () => {
  it.each([0, -5, 1.5, Number.NaN])('rejects %s as not a positive integer', (q) => {
    expect(checkAllocationQuantity(q, 100)).toEqual({ ok: false, reason: 'NOT_A_POSITIVE_INTEGER' });
  });
  it('rejects more than available', () => {
    expect(checkAllocationQuantity(101, 100)).toEqual({ ok: false, reason: 'EXCEEDS_AVAILABLE' });
  });
  it('accepts exactly the available amount (boundary)', () => {
    expect(checkAllocationQuantity(100, 100)).toEqual({ ok: true });
  });
  it('accepts the minimum of 1 (boundary)', () => {
    expect(checkAllocationQuantity(1, 100)).toEqual({ ok: true });
  });
});
