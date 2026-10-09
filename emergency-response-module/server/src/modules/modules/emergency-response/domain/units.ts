/** JOINT #7: one unit per item. Values match the CHECK constraint in migration 401. */
export enum ResourceUnit {
  Kilogram = 'kg',
  Litre = 'litre',
  Piece = 'piece',
  Box = 'box',
  Pack = 'pack',
}

const LABELS: Readonly<Record<ResourceUnit, { one: string; many: string }>> = {
  [ResourceUnit.Kilogram]: { one: 'kg', many: 'kg' },
  [ResourceUnit.Litre]: { one: 'litre', many: 'litres' },
  [ResourceUnit.Piece]: { one: 'piece', many: 'pieces' },
  [ResourceUnit.Box]: { one: 'box', many: 'boxes' },
  [ResourceUnit.Pack]: { one: 'pack', many: 'packs' },
};

/** "1,200 litres", "1 box". Fixed locale so output is identical on every server. */
export function formatQuantity(quantity: number, unit: ResourceUnit): string {
  const label = LABELS[unit];
  const text = new Intl.NumberFormat('en-US').format(quantity);
  return `${text} ${quantity === 1 ? label.one : label.many}`;
}
