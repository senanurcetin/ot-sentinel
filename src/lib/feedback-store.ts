import type { AlertFeedback } from '@/lib/types';

/**
 * Where operator verdicts ("confirmed threat" / "false alarm") are kept.
 *
 * - `FEEDBACK_DB_PATH` set (e.g. a Docker volume): SQLite via Node's built-in `node:sqlite`, so
 *   verdicts survive restarts and no native dependency is added.
 * - Not set (Vercel, tests, `npm run dev`): a capped in-memory buffer, lost on restart.
 *
 * Both are bounded: the demo has no authentication, so an anonymous client must not be able to grow
 * storage without limit (the route is also rate-limited).
 */
export type StoredFeedback = AlertFeedback & { received_at: string };

export type FeedbackSummary = {
  storage: 'sqlite' | 'memory';
  total: number;
  confirmed_threat: number;
  false_alarm: number;
  /** Share of verdicts that were false alarms; null when there are none yet. */
  false_alarm_share: number | null;
  /** Verdicts grouped by the sensor that drove the alert (only verdicts that reported one). */
  by_top_sensor: { sensor: string; total: number; false_alarm: number }[];
};

export interface FeedbackStore {
  readonly kind: FeedbackSummary['storage'];
  add(entry: StoredFeedback): void;
  summary(): FeedbackSummary;
}

export const MEMORY_LIMIT = 200;
export const SQLITE_LIMIT = 10_000;

function summarize(kind: FeedbackSummary['storage'], rows: StoredFeedback[]): FeedbackSummary {
  const falseAlarms = rows.filter((r) => r.verdict === 'false_alarm').length;
  const bySensor = new Map<string, { total: number; false_alarm: number }>();
  for (const r of rows) {
    if (!r.top_sensor) continue;
    const s = bySensor.get(r.top_sensor) ?? { total: 0, false_alarm: 0 };
    s.total += 1;
    if (r.verdict === 'false_alarm') s.false_alarm += 1;
    bySensor.set(r.top_sensor, s);
  }
  return {
    storage: kind,
    total: rows.length,
    confirmed_threat: rows.length - falseAlarms,
    false_alarm: falseAlarms,
    false_alarm_share: rows.length ? falseAlarms / rows.length : null,
    by_top_sensor: [...bySensor.entries()]
      .map(([sensor, s]) => ({ sensor, ...s }))
      .sort((a, b) => a.sensor.localeCompare(b.sensor)),
  };
}

export class MemoryFeedbackStore implements FeedbackStore {
  readonly kind = 'memory' as const;
  private rows: StoredFeedback[] = [];

  constructor(private readonly limit = MEMORY_LIMIT) {}

  add(entry: StoredFeedback): void {
    this.rows.push(entry);
    if (this.rows.length > this.limit) this.rows.shift();
  }

  summary(): FeedbackSummary {
    return summarize(this.kind, this.rows);
  }
}

type SqliteDatabase = InstanceType<typeof import('node:sqlite').DatabaseSync>;

export class SqliteFeedbackStore implements FeedbackStore {
  readonly kind = 'sqlite' as const;

  constructor(
    private readonly db: SqliteDatabase,
    private readonly limit = SQLITE_LIMIT
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      verdict TEXT NOT NULL CHECK (verdict IN ('confirmed_threat', 'false_alarm')),
      note TEXT,
      risk_score REAL,
      top_sensor TEXT,
      received_at TEXT NOT NULL
    )`);
  }

  add(entry: StoredFeedback): void {
    this.db
      .prepare(
        `INSERT INTO feedback (timestamp, verdict, note, risk_score, top_sensor, received_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.timestamp,
        entry.verdict,
        entry.note ?? null,
        entry.risk_score ?? null,
        entry.top_sensor ?? null,
        entry.received_at
      );
    // Keep only the newest `limit` rows.
    this.db
      .prepare(
        'DELETE FROM feedback WHERE id NOT IN (SELECT id FROM feedback ORDER BY id DESC LIMIT ?)'
      )
      .run(this.limit);
  }

  summary(): FeedbackSummary {
    const rows = this.db
      .prepare('SELECT timestamp, verdict, top_sensor, received_at FROM feedback ORDER BY id')
      .all() as {
      timestamp: string;
      verdict: StoredFeedback['verdict'];
      top_sensor: StoredFeedback['top_sensor'] | null;
      received_at: string;
    }[];
    return summarize(
      this.kind,
      rows.map((r) => ({ ...r, top_sensor: r.top_sensor ?? undefined }))
    );
  }
}

/**
 * Opens the store chosen by the environment. `node:sqlite` is imported only when a database path
 * is configured, so environments without one never load it.
 */
export async function openFeedbackStore(
  dbPath = process.env.FEEDBACK_DB_PATH
): Promise<FeedbackStore> {
  if (!dbPath) return new MemoryFeedbackStore();
  const { DatabaseSync } = await import('node:sqlite');
  return new SqliteFeedbackStore(new DatabaseSync(dbPath));
}

const GLOBAL_KEY = Symbol.for('ot-sentinel.feedback-store');
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: Promise<FeedbackStore> };

/**
 * The process-wide store. Kept on `globalThis` because Next.js can bundle each route separately,
 * and the POST and summary routes must see the same verdicts.
 */
export function getFeedbackStore(): Promise<FeedbackStore> {
  const g = globalThis as GlobalWithStore;
  g[GLOBAL_KEY] ??= openFeedbackStore();
  return g[GLOBAL_KEY];
}

/** Test helper: forget the process-wide store so the next call opens a fresh one. */
export function resetFeedbackStore(): void {
  delete (globalThis as GlobalWithStore)[GLOBAL_KEY];
}
