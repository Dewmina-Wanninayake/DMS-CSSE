/** JOINT #7: one unit per item. Values are the critique's Table 13 names and match the CHECK constraint in migration 401. */
export enum ResourceUnit {
  Kilogram = 'Kilogram',
  Litre = 'Litre',
  Unit = 'Unit',
  Pallet = 'Pallet',
}

const LABELS: Readonly<Record<ResourceUnit, { one: string; many: string }>> = {
  [ResourceUnit.Kilogram]: { one: 'kg', many: 'kg' },
  [ResourceUnit.Litre]: { one: 'litre', many: 'litres' },
  [ResourceUnit.Unit]: { one: 'unit', many: 'units' },
  [ResourceUnit.Pallet]: { one: 'pallet', many: 'pallets' },
};

/** "1,200 litres", "1 box". Fixed locale so output is identical on every server. */
export function formatQuantity(quantity: number, unit: ResourceUnit): string {
  const label = LABELS[unit];
  const text = new Intl.NumberFormat('en-US').format(quantity);
  return `${text} ${quantity === 1 ? label.one : label.many}`;
}
