/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  MemoryFeedbackStore,
  SqliteFeedbackStore,
  getFeedbackStore,
  openFeedbackStore,
  resetFeedbackStore,
  type StoredFeedback,
} from '@/lib/feedback-store';

const entry = (verdict: StoredFeedback['verdict'], extra: Partial<StoredFeedback> = {}): StoredFeedback => ({
  timestamp: '2026-01-01T00:00:00Z',
  verdict,
  received_at: '2026-01-01T00:00:01Z',
  ...extra,
});

describe.each([
  ['memory', () => new MemoryFeedbackStore()],
  ['sqlite', () => new SqliteFeedbackStore(new DatabaseSync(':memory:'))],
])('%s store', (_kind, make) => {
  it('summarises verdicts overall and per driving sensor', () => {
    const store = make();
    store.add(entry('false_alarm', { top_sensor: 'temp', risk_score: 55 }));
    store.add(entry('false_alarm', { top_sensor: 'temp' }));
    store.add(entry('confirmed_threat', { top_sensor: 'vibration' }));
    store.add(entry('confirmed_threat')); // no sensor reported
    expect(store.summary()).toMatchObject({
      total: 4,
      confirmed_threat: 2,
      false_alarm: 2,
      false_alarm_share: 0.5,
      by_top_sensor: [
        { sensor: 'temp', total: 2, false_alarm: 2 },
        { sensor: 'vibration', total: 1, false_alarm: 0 },
      ],
    });
  });

  it('computes a rolling 24h window from server receipt time (not event time)', () => {
    const store = make();
    const now = Date.now();
    const receivedAt = (offset: number) => new Date(now + offset).toISOString();
    // An arbitrary/old event timestamp must not determine time-window membership.
    store.add(entry('false_alarm', { received_at: receivedAt(-1000), timestamp: '1970-01-01' }));
    store.add(entry('confirmed_threat', { received_at: receivedAt(-24 * 60 * 60 * 1000 + 1000) }));
    store.add(entry('false_alarm', { received_at: receivedAt(-24 * 60 * 60 * 1000 - 1000) }));
    store.add(entry('false_alarm', { received_at: receivedAt(60 * 1000) }));
    store.add(entry('false_alarm', { received_at: 'invalid' }));
    expect(store.summary()).toMatchObject({
      total: 5,
      recent_24h: { total: 2, confirmed_threat: 1, false_alarm: 1, false_alarm_share: 0.5 },
    });
  });

  it('has no false-alarm share before the first verdict', () => {
    expect(make().summary()).toMatchObject({ total: 0, false_alarm_share: null, by_top_sensor: [] });
  });

  it('never returns the free-text notes', () => {
    const store = make();
    store.add(entry('false_alarm', { note: 'operator name and phone number' }));
    expect(JSON.stringify(store.summary())).not.toContain('operator name');
  });
});

describe('bounded storage', () => {
  it('memory keeps only the newest entries', () => {
    const store = new MemoryFeedbackStore(2);
    store.add(entry('confirmed_threat'));
    store.add(entry('false_alarm'));
    store.add(entry('false_alarm'));
    expect(store.summary()).toMatchObject({ total: 2, false_alarm: 2 });
  });

  it('sqlite keeps only the newest rows', () => {
    const store = new SqliteFeedbackStore(new DatabaseSync(':memory:'), 2);
    store.add(entry('confirmed_threat'));
    store.add(entry('false_alarm'));
    store.add(entry('false_alarm'));
    expect(store.summary()).toMatchObject({ total: 2, false_alarm: 2 });
  });

  it('sqlite atomically rolls back an insertion when retention fails', () => {
    const db = new DatabaseSync(':memory:');
    const store = new SqliteFeedbackStore(db, 1);
    store.add(entry('confirmed_threat'));
    // Force the second insertion's retention delete to fail. The transaction
    // must roll back the inserted false alarm rather than leaking an extra row.
    db.exec(`CREATE TRIGGER reject_prune BEFORE DELETE ON feedback
      BEGIN SELECT RAISE(ABORT, 'cannot prune'); END;`);
    expect(() => store.add(entry('false_alarm'))).toThrow('cannot prune');
    expect(store.summary()).toMatchObject({
      total: 1, confirmed_threat: 1, false_alarm: 0,
    });
  });

  it('sqlite rejects a verdict outside the schema even if validation were bypassed', () => {
    const store = new SqliteFeedbackStore(new DatabaseSync(':memory:'));
    expect(() => store.add({ ...entry('false_alarm'), verdict: 'maybe' as never })).toThrow();
  });
});

describe('openFeedbackStore', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ot-feedback-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('uses memory when no database path is configured', async () => {
    expect((await openFeedbackStore(undefined)).kind).toBe('memory');
  });

  it('persists verdicts across reopening the same database file', async () => {
    const path = join(dir, 'feedback.db');
    (await openFeedbackStore(path)).add(entry('false_alarm', { top_sensor: 'pressure' }));
    const reopened = await openFeedbackStore(path);
    expect(reopened.kind).toBe('sqlite');
    expect(reopened.summary()).toMatchObject({ total: 1, by_top_sensor: [{ sensor: 'pressure' }] });
  });
});

describe('getFeedbackStore', () => {
  afterEach(() => resetFeedbackStore());

  it('returns one process-wide store until reset', async () => {
    const a = await getFeedbackStore();
    expect(await getFeedbackStore()).toBe(a);
    resetFeedbackStore();
    expect(await getFeedbackStore()).not.toBe(a);
  });
});
