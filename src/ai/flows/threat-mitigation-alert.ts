'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating threat mitigation alerts.
 *
 * - generateThreatMitigationAlert - A function that generates a threat mitigation alert.
 */

import {headers} from 'next/headers';
import {ai} from '@/ai/genkit';
import {buildFallbackAlert} from '@/lib/fallback-mitigation';
import {RateLimiter, clientKey} from '@/lib/rate-limit';
import {withTimeout} from '@/lib/with-timeout';
import {
  ThreatMitigationAlertInputSchema,
  ThreatMitigationAlertOutputSchema,
  type ThreatMitigationAlertInput,
  type ThreatMitigationAlertResult,
} from '@/lib/types';

// A server action is a public endpoint and every call costs a model request: cap how long we wait
// and how often one client can trigger it. Over the cap, callers get the rule-based guidance.
const AI_TIMEOUT_MS = 20_000;
const aiLimiter = new RateLimiter(10, 60_000);

async function callerKey(): Promise<string> {
  try {
    return clientKey(await headers());
  } catch {
    return 'unknown'; // outside a request scope (tests, Genkit dev UI)
  }
}

export async function generateThreatMitigationAlert(
  rawInput: ThreatMitigationAlertInput
): Promise<ThreatMitigationAlertResult> {
  // Server action arguments come from the client: validate instead of trusting the TS type.
  const input = ThreatMitigationAlertInputSchema.parse(rawInput);

  if (!aiLimiter.check(await callerKey()).allowed) {
    return {...buildFallbackAlert(input), source: 'fallback'};
  }
  try {
    const output = await withTimeout(threatMitigationAlertFlow(input), AI_TIMEOUT_MS, 'AI explanation');
    return {...output, source: 'ai'};
  } catch (error) {
    console.error('AI explanation failed, using rule-based guidance:', error);
    return {...buildFallbackAlert(input), source: 'fallback'};
  }
}

const threatMitigationAlertPrompt = ai.definePrompt({
  name: 'threatMitigationAlertPrompt',
  input: {schema: ThreatMitigationAlertInputSchema},
  output: {schema: ThreatMitigationAlertOutputSchema},
  prompt: `You are a top-tier cybersecurity analyst specializing in Operational Technology (OT) environments. Your task is to analyze the provided security event data and generate a clear, actionable threat assessment.

Based on the following data, provide a concise threat summary and a list of specific, prioritized mitigation steps. The response MUST be in a valid JSON format, adhering to the specified output schema.

**Security Event Data:**
- **Timestamp:** {{{timestamp}}}
- **Status:** {{{status}}}
- **Anomaly Score:** {{{anomaly_score}}}
{{#if risk_score}}- **Detector Risk Score:** {{{risk_score}}}/100{{/if}}
{{#if per_sensor_contributions}}- **Sensors driving the score (largest first):**
{{#each per_sensor_contributions}}  - {{{sensor}}}: z={{{z_score}}} ({{{contribution_pct}}}% of total, {{{status}}})
{{/each}}{{/if}}
- **Log Entry:** "{{{log_entry}}}"
- **Source IP:** {{{network_traffic}}}
- **System Metrics:**
  - Temperature: {{{metrics.temp}}}°C
  - Pressure: {{{metrics.pressure}}} hPa
  - Vibration: {{{metrics.vibration}}} g

The statistical detector has ALREADY decided this event is anomalous; do not dispute or re-score it. Your job is to explain it: say which sensors drive the score and what that pattern could mean. Use only the data above, state uncertainty where the data cannot distinguish a cyberattack from a physical fault, and do not invent device names, protocols or CVEs.

Analyze this data to identify the nature of the threat. For example, high temperature and vibration might indicate physical tampering, while suspicious network traffic points to a cyberattack.

Formulate a response with a 'summary' that explains the threat in simple terms and 'suggestedActions' that provide a step-by-step guide for containment and recovery.`,
});

const threatMitigationAlertFlow = ai.defineFlow(
  {
    name: 'threatMitigationAlertFlow',
    inputSchema: ThreatMitigationAlertInputSchema,
    outputSchema: ThreatMitigationAlertOutputSchema,
  },
  async (input) => {
    const {output} = await threatMitigationAlertPrompt(input);
    return output!;
  }
);
