import { z } from 'zod';

export type SensorContribution = {
  sensor: string;
  z_score: number;
  contribution_pct: number;
  status: 'normal' | 'warning' | 'critical';
};

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
  risk_score: number;
  per_sensor_contributions: SensorContribution[];
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
  risk_score: z
    .number()
    .optional()
    .describe('Detector risk score from 0 (nominal) to 100 (severe).'),
  per_sensor_contributions: z
    .array(
      z.object({
        sensor: z.string(),
        z_score: z.number(),
        contribution_pct: z.number(),
        status: z.enum(['normal', 'warning', 'critical']),
      })
    )
    .optional()
    .describe('Which sensors drive the detector score, largest first.'),
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

export const AlertFeedbackSchema = z.object({
  timestamp: z.string().min(1).max(64),
  verdict: z.enum(['confirmed_threat', 'false_alarm']),
  note: z.string().max(500).optional(),
});
export type AlertFeedback = z.infer<typeof AlertFeedbackSchema>;
