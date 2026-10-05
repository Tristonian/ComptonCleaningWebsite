import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../../test/pg-test-db';
import type { Db } from './db';
import { createRound } from './customers';
import { addEntry, deleteEntry, isTakingCalls, listCallHours, listEntries, setCallHours } from './schedule';
import { callableAt, cleanTime, londonParts, weekdayOf, windowsOn } from './schedule-shared';

const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '17:00' }));

describe('schedule rules', () => {
  it('cleans times', () => {
    expect(cleanTime('9:05')).toBe('09:05');
    expect(cleanTime('09:05:00')).toBe('09:05');
    expect(cleanTime('24:00')).toBeNull();
    expect(cleanTime('nine')).toBeNull();
  });

  it('reads London wall-clock time across the clock change', () => {
    // 2026-07-01 is BST (UTC+1); 2026-01-15 is GMT.
    expect(londonParts(new Date('2026-07-01T08:30:00Z'))).toEqual({ date: '2026-07-01', time: '09:30', weekday: 3 });
    expect(londonParts(new Date('2026-01-15T08:30:00Z'))).toEqual({ date: '2026-01-15', time: '08:30', weekday: 4 });
    // Just after midnight in London is still the previous day in UTC.
    expect(londonParts(new Date('2026-07-01T23:30:00Z')).date).toBe('2026-07-02');
    expect(weekdayOf('2026-10-04')).toBe(7);
  });

  it('is callable inside a window only, never at the weekend', () => {
    const tue = (utc: string) => new Date(`2026-10-06T${utc}:00Z`); // 6 Oct 2026 is a Tuesday, BST
    expect(callableAt(tue('07:59'), WEEK, [])).toBe(false); // 08:59 London
    expect(callableAt(tue('08:00'), WEEK, [])).toBe(true); // 09:00 London: opens
    expect(callableAt(tue('15:59'), WEEK, [])).toBe(true);
    expect(callableAt(tue('16:00'), WEEK, [])).toBe(false); // 17:00 London: closed
    expect(callableAt(new Date('2026-10-10T10:00:00Z'), WEEK, [])).toBe(false); // Saturday
  });

  it('lets a dated entry add a window or switch the day off', () => {
    const sat = '2026-10-10';
    const extra = [{ onDate: sat, kind: 'callable' as const, starts: '10:00', ends: '12:00' }];
    expect(windowsOn(sat, WEEK, extra)).toEqual([{ opens: '10:00', closes: '12:00' }]);
    expect(callableAt(new Date('2026-10-10T09:00:00Z'), WEEK, extra)).toBe(true); // 10:00 London

    const off = [{ onDate: '2026-10-06', kind: 'not_callable' as const, starts: null, ends: null }];
    expect(windowsOn('2026-10-06', WEEK, off)).toEqual([]);
    expect(windowsOn('2026-10-07', WEEK, off)).toHaveLength(1);
  });
});

describe('schedule store', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it('replaces a weekday and validates windows', async () => {
    expect((await setCallHours(1, [{ opens: '09:00', closes: '12:00' }, { opens: '13:00', closes: '17:00' }], 'a@b.c', db)).ok).toBe(true);
    expect(await listCallHours(db)).toEqual([
      { weekday: 1, opens: '09:00', closes: '12:00' },
      { weekday: 1, opens: '13:00', closes: '17:00' },
    ]);
    expect((await setCallHours(1, [{ opens: '09:00', closes: '09:00' }], 'a@b.c', db)).ok).toBe(false);
    expect((await setCallHours(8, [], 'a@b.c', db)).ok).toBe(false);
    expect((await setCallHours(1, [], 'a@b.c', db)).ok).toBe(true); // no windows = no calls
    expect(await listCallHours(db)).toEqual([]);
  });

  it('adds, lists and deletes entries; a round needs a real round', async () => {
    const round = await createRound({ name: 'Lyde Green', weekday: 2 }, 'a@b.c', db);
    expect(round.ok).toBe(true);
    const roundId = (round as { id: string }).id;
    expect((await addEntry({ onDate: '2026-10-06', kind: 'round', roundId, starts: '08:00' }, 'a@b.c', db)).ok).toBe(true);
    expect((await addEntry({ onDate: '2026-10-06', kind: 'callable', starts: '18:00', ends: '19:00' }, 'a@b.c', db)).ok).toBe(true);
    expect((await addEntry({ onDate: '2026-10-07', kind: 'not_callable', note: 'Day off' }, 'a@b.c', db)).ok).toBe(true);
    expect((await addEntry({ onDate: '2026-10-06', kind: 'round', roundId: '999' }, 'a@b.c', db)).ok).toBe(false);
    expect((await addEntry({ onDate: '2026-10-06', kind: 'callable', starts: '19:00', ends: '18:00' }, 'a@b.c', db)).ok).toBe(false);
    expect((await addEntry({ onDate: '2026-02-30', kind: 'not_callable' }, 'a@b.c', db)).ok).toBe(false);

    const week = await listEntries('2026-10-05', '2026-10-11', db);
    expect(week.map((e) => [e.onDate, e.kind, e.roundName])).toEqual([
      ['2026-10-06', 'round', 'Lyde Green'],
      ['2026-10-06', 'callable', null],
      ['2026-10-07', 'not_callable', null],
    ]);
    expect((await deleteEntry(week[2].id, 'a@b.c', db)).ok).toBe(true);
    expect(await listEntries('2026-10-05', '2026-10-11', db)).toHaveLength(2);
    expect((await deleteEntry('999', 'a@b.c', db)).ok).toBe(false);
  });

  it('deleting a round removes its schedule entries', async () => {
    const round = (await createRound({ name: 'Temp', weekday: 3 }, 'a@b.c', db)) as { id: string };
    await addEntry({ onDate: '2026-10-07', kind: 'round', roundId: round.id }, 'a@b.c', db);
    await db.query('DELETE FROM rounds WHERE id = $1', [round.id]);
    expect(await listEntries('2026-10-07', '2026-10-07', db)).toEqual([]);
  });

  it('takes calls when nothing is set (fails open) and follows the hours once set', async () => {
    const tueNoon = new Date('2026-10-06T11:00:00Z');
    expect(await isTakingCalls(tueNoon, db)).toBe(true);
    for (const wd of [1, 2, 3, 4, 5]) await setCallHours(wd, [{ opens: '09:00', closes: '17:00' }], 'a@b.c', db);
    expect(await isTakingCalls(tueNoon, db)).toBe(true);
    expect(await isTakingCalls(new Date('2026-10-06T19:00:00Z'), db)).toBe(false);
    expect(await isTakingCalls(new Date('2026-10-10T11:00:00Z'), db)).toBe(false); // Saturday
    await addEntry({ onDate: '2026-10-06', kind: 'not_callable' }, 'a@b.c', db);
    expect(await isTakingCalls(tueNoon, db)).toBe(false);
  });

  it('fails open when the database cannot be read', async () => {
    const broken: Db = {
      async query() {
        throw new Error('down');
      },
      async transaction() {
        throw new Error('down');
      },
    };
    expect(await isTakingCalls(new Date(), broken)).toBe(true);
  });
});

import { addDays, monthGrid, shiftMonth, validDate, weekStart } from './schedule-shared';

describe('calendar dates', () => {
  it('does date arithmetic across month and clock-change boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // clocks go forward on the 29th
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // a Sunday belongs to the week before
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(validDate('2026-02-30')).toBeNull();
    expect(validDate('2026-02-28')).toBe('2026-02-28');
  });

  it('lays a month out in Monday-first weeks', () => {
    const grid = monthGrid('2026-10-15');
    expect(grid[0][0]).toBe('2026-09-28');
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain('2026-10-31');
    expect(grid.at(-1)![6] >= '2026-10-31').toBe(true);
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
  });
});

import { assignLanes, DEFAULT_ROUND_MINUTES, fromMinutes, hourRange, laneStyle, roundColour, snapQuarter, toMinutes } from './schedule-shared';

describe('the time grid', () => {
  it('converts times and snaps to quarter hours', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(fromMinutes(570)).toBe('09:30');
    expect(fromMinutes(-5)).toBe('00:00');
    expect(fromMinutes(99999)).toBe('23:59');
    expect(snapQuarter(547)).toBe(540);
    expect(snapQuarter(553)).toBe(555);
    expect(DEFAULT_ROUND_MINUTES).toBe(60);
  });

  it('shows at least 7 to 19 and widens to fit anything outside', () => {
    expect(hourRange([])).toEqual({ minHour: 7, maxHour: 19 });
    expect(hourRange([{ start: 9 * 60, end: 17 * 60 }])).toEqual({ minHour: 7, maxHour: 19 });
    expect(hourRange([{ start: 5 * 60 + 30, end: 21 * 60 + 15 }])).toEqual({ minHour: 5, maxHour: 22 });
    expect(hourRange([{ start: 0, end: 24 * 60 }])).toEqual({ minHour: 0, maxHour: 24 });
  });

  it('puts simultaneous things side by side, but not back-to-back ones', () => {
    const lanes = assignLanes([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 600, end: 660 }, // starts as a ends: shares with b only
      { id: 'd', start: 720, end: 780 }, // alone
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
    expect(assignLanes([{ id: 'x', start: 540, end: 600 }, { id: 'y', start: 600, end: 660 }]).get('y')).toEqual({ lane: 0, lanes: 1 });
  });

  it('does not depend on the order things arrive in', () => {
    const items = [
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 540, end: 600 },
      { id: 'c', start: 560, end: 700 },
    ];
    const one = assignLanes(items);
    const two = assignLanes([...items].reverse());
    for (const i of items) expect(one.get(i.id)).toEqual(two.get(i.id));
    expect(one.get('a')!.lanes).toBe(3);
  });

  it('turns a lane into percentages and gives rounds distinct colours', () => {
    expect(laneStyle({ lane: 0, lanes: 1 })).toEqual({ left: '0%', width: '100%' });
    const second = laneStyle({ lane: 1, lanes: 2 });
    expect(parseFloat(second.left)).toBeGreaterThan(50);
    expect(parseFloat(second.left) + parseFloat(second.width)).toBeCloseTo(100, 5);
    expect(roundColour(0).fill).not.toBe(roundColour(1).fill);
  });
});
