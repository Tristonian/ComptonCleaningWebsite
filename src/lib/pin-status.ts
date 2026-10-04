// What colour a customer's pin is on the map (pure, unit tested). One status per customer, picked in
// priority order so the thing Sam most needs to act on wins: money owed, then overdue, then due soon.

export type PinStatus = 'owing' | 'overdue' | 'due' | 'ok' | 'none';

export const PIN_STATUSES: { key: PinStatus; label: string; colour: string; hint: string }[] = [
  { key: 'owing', label: 'Owes money', colour: '#c62828', hint: 'A done visit is not paid' },
  { key: 'overdue', label: 'Overdue', colour: '#ef6c00', hint: 'Was due before this week' },
  { key: 'due', label: 'Due this week', colour: '#f9a825', hint: 'Due by Sunday' },
  { key: 'ok', label: 'Up to date', colour: '#2e7d32', hint: 'Next clean is later' },
  { key: 'none', label: 'No schedule', colour: '#757575', hint: 'No “every … weeks” set' },
];

export const colourOf = (s: PinStatus) => PIN_STATUSES.find((p) => p.key === s)!.colour;
export const labelOf = (s: PinStatus) => PIN_STATUSES.find((p) => p.key === s)!.label;

export function pinStatus(
  c: { owingPence: number; nextDue: string | null },
  today: string,
  weekEnd: string,
): PinStatus {
  if (c.owingPence > 0) return 'owing';
  if (c.nextDue === null) return 'none';
  if (c.nextDue < today) return 'overdue';
  if (c.nextDue <= weekEnd) return 'due';
  return 'ok';
}
