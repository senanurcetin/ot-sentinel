'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating threat mitigation alerts.
 *
 * - generateThreatMitigationAlert - A function that generates a threat mitigation alert.
 */

import {ai} from '@/ai/genkit';
import {
  ThreatMitigationAlertInputSchema,
  ThreatMitigationAlertOutputSchema,
  type ThreatMitigationAlertInput,
  type ThreatMitigationAlertOutput,
} from '@/lib/types';

export async function generateThreatMitigationAlert(
  input: ThreatMitigationAlertInput
): Promise<ThreatMitigationAlertOutput> {
  return threatMitigationAlertFlow(input);
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
- **Log Entry:** "{{{log_entry}}}"
- **Source IP:** {{{network_traffic}}}
- **System Metrics:**
  - Temperature: {{{metrics.temp}}}°C
  - Pressure: {{{metrics.pressure}}} hPa
  - Vibration: {{{metrics.vibration}}} g

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
