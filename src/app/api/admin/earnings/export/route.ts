import { getAdmin } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { listPaymentMethods, todayLondon } from '@/lib/customers';
import { cleanRange, listCollected, monthRangeOf, paymentsCsv } from '@/lib/earnings';

export const dynamic = 'force-dynamic';

/** The earnings window as a CSV. A route is an HTTP endpoint, so it checks the admin itself (ADR 0003). */
export async function GET(req: Request): Promise<Response> {
  const admin = await getAdmin();
  if (!admin) return new Response('Not signed in.', { status: 401, headers: { 'cache-control': 'no-store' } });
  const url = new URL(req.url);
  const { from, to } = cleanRange(url.searchParams.get('from'), url.searchParams.get('to'), monthRangeOf(todayLondon()));
  const db = getDb();
  const [rows, methods] = await Promise.all([listCollected(from, to, db), listPaymentMethods(db)]);
  const csv = paymentsCsv(rows, (k) => methods.find((m) => m.key === k)?.label ?? k);
  return new Response(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="earnings-${from}-to-${to}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
