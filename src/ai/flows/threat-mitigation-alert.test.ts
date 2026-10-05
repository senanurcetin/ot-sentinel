/** @jest-environment node */
import { ai } from '@/ai/genkit';
import {
  ThreatMitigationAlertInputSchema,
  ThreatMitigationAlertOutputSchema,
  type ThreatMitigationAlertInput,
} from '@/lib/types';

// Genkit is replaced by a stub that captures how the prompt and flow are defined.
const promptFn = jest.fn();
jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: jest.fn(() => promptFn),
    defineFlow: jest.fn((_config: unknown, handler: unknown) => handler),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateThreatMitigationAlert } = require('./threat-mitigation-alert');

const input: ThreatMitigationAlertInput = {
  timestamp: '2026-01-01T00:00:00.000Z',
  metrics: { temp: 120, pressure: 1150, vibration: 1.5 },
  network_traffic: '203.0.113.45',
  status: 'CRITICAL',
  anomaly_score: 0.99,
  risk_score: 90,
  per_sensor_contributions: [{ sensor: 'vibration', z_score: 60, contribution_pct: 70, status: 'critical' }],
  log_entry: 'ANOMALY DETECTED',
};

describe('threat mitigation flow', () => {
  it('passes the event to the prompt and returns its structured output', async () => {
    promptFn.mockResolvedValue({ output: { summary: 'S', suggestedActions: ['A'] } });
    await expect(generateThreatMitigationAlert(input)).resolves.toEqual({ summary: 'S', suggestedActions: ['A'] });
    expect(promptFn).toHaveBeenCalledWith(input);
  });

  it('registers the prompt with the shared zod schemas', () => {
    const [config] = (ai.definePrompt as jest.Mock).mock.calls[0];
    expect(config.input.schema).toBe(ThreatMitigationAlertInputSchema);
    expect(config.output.schema).toBe(ThreatMitigationAlertOutputSchema);
  });

  it('tells the model to explain the detector verdict, not re-decide it', () => {
    const [config] = (ai.definePrompt as jest.Mock).mock.calls[0];
    expect(config.prompt).toMatch(/ALREADY decided/);
    expect(config.prompt).toMatch(/do not invent/i);
    expect(config.prompt).toContain('{{{risk_score}}}');
    expect(config.prompt).toContain('{{#each per_sensor_contributions}}');
  });
});

describe('schemas', () => {
  it('accepts an event with and without the optional detector fields', () => {
    expect(ThreatMitigationAlertInputSchema.safeParse(input).success).toBe(true);
    const legacy = { ...input, risk_score: undefined, per_sensor_contributions: undefined };
    expect(ThreatMitigationAlertInputSchema.safeParse(legacy).success).toBe(true);
  });

  it.each([
    ['unknown status', { ...input, status: 'WARNING' }],
    ['missing metrics', { ...input, metrics: undefined }],
    ['bad sensor status', { ...input, per_sensor_contributions: [{ ...input.per_sensor_contributions![0], status: 'bad' }] }],
  ])('rejects %s', (_label, bad) => {
    expect(ThreatMitigationAlertInputSchema.safeParse(bad).success).toBe(false);
  });

  it('requires summary and a list of actions in the output', () => {
    expect(ThreatMitigationAlertOutputSchema.safeParse({ summary: 'x', suggestedActions: ['a'] }).success).toBe(true);
    expect(ThreatMitigationAlertOutputSchema.safeParse({ summary: 'x' }).success).toBe(false);
    expect(ThreatMitigationAlertOutputSchema.safeParse({ summary: 'x', suggestedActions: 'a' }).success).toBe(false);
  });
});
