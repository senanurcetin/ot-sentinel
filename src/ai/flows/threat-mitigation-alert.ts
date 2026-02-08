'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating threat mitigation alerts.
 *
 * - generateThreatMitigationAlert - A function that generates a threat mitigation alert.
 * - ThreatMitigationAlertInput - The input type for the generateThreatMitigationAlert function.
 * - ThreatMitigationAlertOutput - The return type for the generateThreatMitigationAlert function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ThreatMitigationAlertInputSchema = z.object({
  timestamp: z.string().describe('The timestamp of the security event.'),
  metrics: z.object({
    temp: z.number().describe('The temperature metric.'),
    pressure: z.number().describe('The pressure metric.'),
    vibration: z.number().describe('The vibration metric.'),
  }).describe('The metrics associated with the security event.'),
  network_traffic: z.string().describe('The network traffic information.'),
  status: z.enum(['SECURE', 'CRITICAL']).describe('The security status.'),
  anomaly_score: z.number().describe('The anomaly score of the event.'),
  log_entry: z.string().describe('The log entry associated with the event.'),
});
export type ThreatMitigationAlertInput = z.infer<typeof ThreatMitigationAlertInputSchema>;

const ThreatMitigationAlertOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the threat.'),
  suggestedActions: z.array(z.string()).describe('A list of suggested mitigation actions.'),
});
export type ThreatMitigationAlertOutput = z.infer<typeof ThreatMitigationAlertOutputSchema>;

export async function generateThreatMitigationAlert(input: ThreatMitigationAlertInput): Promise<ThreatMitigationAlertOutput> {
  return threatMitigationAlertFlow(input);
}

const threatMitigationAlertPrompt = ai.definePrompt({
  name: 'threatMitigationAlertPrompt',
  input: {schema: ThreatMitigationAlertInputSchema},
  output: {schema: ThreatMitigationAlertOutputSchema},
  prompt: `You are a cybersecurity expert. When given information about a potential security threat, you will generate a concise summary of the threat and suggest potential mitigation actions.

  Here is the information about the threat:
  Timestamp: {{{timestamp}}}
  Metrics: Temp={{{metrics.temp}}}, Pressure={{{metrics.pressure}}}, Vibration={{{metrics.vibration}}}
  Network Traffic: {{{network_traffic}}}
  Status: {{{status}}}
  Anomaly Score: {{{anomaly_score}}}
  Log Entry: {{{log_entry}}}

  Respond with a summary of the threat and a list of suggested mitigation actions.
  Summary:
  Suggested Actions:`, 
});

const threatMitigationAlertFlow = ai.defineFlow(
  {
    name: 'threatMitigationAlertFlow',
    inputSchema: ThreatMitigationAlertInputSchema,
    outputSchema: ThreatMitigationAlertOutputSchema,
  },
  async input => {
    const {output} = await threatMitigationAlertPrompt(input);
    return output!;
  }
);
