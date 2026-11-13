/**
 * Read batching for the Neon HTTP driver. Every query is its own HTTPS round trip, and on the free
 * Workers plan (10ms CPU per request) each one costs real CPU (request, TLS, JSON). A public page
 * fires about eight reads at once, so reads issued in the same tick are sent as ONE non-interactive
 * transaction instead. Callers do not change: they still `await db.query(...)`.
 *
 * Only plain SELECTs are batched; anything that writes goes straight through. If a batch fails
 * (one bad query must not take the others down), each query is retried on its own.
 */
export interface Pending<Row> {
  text: string;
  params: unknown[];
  resolve: (rows: Row[]) => void;
  reject: (err: unknown) => void;
}

export function isReadQuery(text: string): boolean {
  return /^\s*select\b/i.test(text);
}

export function createReadBatcher<Row>(opts: {
  runOne: (text: string, params: unknown[]) => Promise<Row[]>;
  runMany: (statements: { text: string; params: unknown[] }[]) => Promise<Row[][]>;
  /** Schedules the flush; a microtask by default so every query issued in one tick joins the batch. */
  schedule?: (flush: () => void) => void;
}): (text: string, params?: unknown[]) => Promise<Row[]> {
  const schedule = opts.schedule ?? ((f) => queueMicrotask(f));
  let queue: Pending<Row>[] = [];

  async function flush() {
    const batch = queue;
    queue = [];
    if (batch.length === 0) return;
    if (batch.length === 1) {
      const [only] = batch;
      opts.runOne(only.text, only.params).then(only.resolve, only.reject);
      return;
    }
    try {
      const results = await opts.runMany(batch.map((b) => ({ text: b.text, params: b.params })));
      batch.forEach((b, i) => b.resolve(results[i] ?? []));
    } catch {
      await Promise.all(batch.map((b) => opts.runOne(b.text, b.params).then(b.resolve, b.reject)));
    }
  }

  return (text, params = []) => {
    if (!isReadQuery(text)) return opts.runOne(text, params);
    return new Promise<Row[]>((resolve, reject) => {
      queue.push({ text, params, resolve, reject });
      if (queue.length === 1) schedule(() => void flush());
    });
  };
}
