import 'server-only';
import { getDb, type Db } from '@/lib/db';
import { listCustomers, listRoundOrder, todayLondon } from '@/lib/customers';
import { endOfWeek } from '@/lib/jobs';
import { legSeconds, optimiseOrder, tourSeconds } from '@/lib/route';
import { travelMatrix, MAX_STOPS, type Point, type TravelMatrix } from '@/lib/travel';
import { BASE } from '@/lib/weather';

/**
 * Work out the best order to do a round (ADR 0012): the customers of one round who have a pin, ordered to
 * minimise drive time from where Sam starts: his phone's position when he shares it, else his base. `mode: 'due'` plans only those due this week. Customers without a
 * pin cannot be placed, so they are listed separately and left where they are.
 */

export type PlanStop = { id: string; name: string; address: string; lat: number; lng: number };

export type Plan = {
  /** Proposed order, first stop first. */
  stops: PlanStop[];
  /** Drive seconds: base to stop 1, stop 1 to stop 2, ... (and the last stop home when returning). */
  legs: number[];
  totalSeconds: number;
  /** The same stops in the order Sam has them now, for comparison. */
  currentSeconds: number;
  source: TravelMatrix['source'];
  note?: string;
  unlocated: { id: string; name: string }[];
  /** More stops than one plan covers: only the first MAX_STOPS in the current order were planned. */
  truncated: number;
  returnHome: boolean;
  /** Where the day starts (and ends, when coming back): the phone's position or the home base. */
  start: Point;
  fromHere: boolean;
};

export type PlanMode = 'all' | 'due';

export async function planRound(
  roundId: string,
  opts: { mode?: PlanMode; returnHome?: boolean; today?: string; db?: Db; travel?: (points: Point[]) => Promise<TravelMatrix>; start?: Point } = {},
): Promise<Plan> {
  const db = opts.db ?? getDb();
  const mode = opts.mode ?? 'all';
  const returnHome = opts.returnHome ?? true;
  const today = opts.today ?? todayLondon();
  const travel = opts.travel ?? ((p: Point[]) => travelMatrix(p));
  const start: Point = opts.start ?? BASE;
  const fromHere = opts.start !== undefined;

  const [members, order] = await Promise.all([listCustomers({ roundId }, db), listRoundOrder(roundId, db)]);
  const weekEnd = endOfWeek(today);
  const wanted = members
    .filter((c) => mode === 'all' || (c.nextDue !== null && c.nextDue <= weekEnd))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const located = wanted.filter((c) => c.lat !== null && c.lng !== null);
  const unlocated = wanted.filter((c) => c.lat === null || c.lng === null).map((c) => ({ id: c.id, name: c.name }));
  const planned = located.slice(0, MAX_STOPS);
  const stops: PlanStop[] = planned.map((c) => ({ id: c.id, name: c.name, address: c.address, lat: c.lat as number, lng: c.lng as number }));

  if (stops.length === 0) {
    return { stops: [], legs: [], totalSeconds: 0, currentSeconds: 0, source: 'estimate', unlocated, truncated: 0, returnHome, start, fromHere };
  }
  const matrix = await travel([start, ...stops]);
  const best = optimiseOrder(matrix.seconds, returnHome);
  const current = stops.map((_, i) => i + 1);
  return {
    stops: best.map((i) => stops[i - 1]),
    legs: legSeconds(matrix.seconds, best, returnHome),
    totalSeconds: tourSeconds(matrix.seconds, best, returnHome),
    currentSeconds: tourSeconds(matrix.seconds, current, returnHome),
    source: matrix.source,
    note: matrix.note,
    unlocated,
    truncated: located.length - planned.length,
    returnHome,
    start,
    fromHere,
  };
}
