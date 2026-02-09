import { z } from 'zod';

export type Metrics = {
  timestamp: string;
  metrics: {
    temp: number;
    pressure: number;
    vibration: number;
  };
  network_traffic: string;
  traffic_volume: number;
  status: 'SECURE' | 'CRITICAL';
  anomaly_score: number;
  log_entry: string;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  sourceIp: string;
  payload: string;
  status: 'SECURE' | 'CRITICAL';
};

export const ThreatMitigationAlertInputSchema = z.object({
  timestamp: z.string().describe('The timestamp of the security event.'),
  metrics: z
    .object({
      temp: z.number().describe('The temperature metric.'),
      pressure: z.number().describe('The pressure metric.'),
      vibration: z.number().describe('The vibration metric.'),
    })
    .describe('The metrics associated with the security event.'),
  network_traffic: z.string().describe('The network traffic information.'),
  status: z.enum(['SECURE', 'CRITICAL']).describe('The security status.'),
  anomaly_score: z.number().describe('The anomaly score of the event.'),
  log_entry: z.string().describe('The log entry associated with the event.'),
});
export type ThreatMitigationAlertInput = z.infer<
  typeof ThreatMitigationAlertInputSchema
>;

export const ThreatMitigationAlertOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the threat.'),
  suggestedActions: z
    .array(z.string())
    .describe('A list of suggested mitigation actions.'),
});
export type ThreatMitigationAlertOutput = z.infer<
  typeof ThreatMitigationAlertOutputSchema
>;
