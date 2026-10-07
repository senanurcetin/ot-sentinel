import type { ThreatMitigationAlertInput, ThreatMitigationAlertOutput } from '@/lib/types';

/**
 * Deterministic, rule-based mitigation guidance used when the LLM is unavailable (no API key,
 * timeout, rate limit, invalid output). It only restates what the detector found and gives
 * conservative OT triage steps; it never claims to know the cause.
 */
const SENSOR_ACTIONS: Record<string, string> = {
  temp: 'Temperature: check cooling and heat sources on the affected unit and compare with the local gauge before trusting the remote value.',
  pressure: 'Pressure: verify against the local gauge and confirm relief valves and pressure interlocks are in their expected state.',
  vibration: 'Vibration: inspect rotating equipment (pump, motor, bearings) for a mechanical cause and reduce load if the local reading confirms it.',
};

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Only well-formed IPv4 literals are echoed into the guidance text. */
function parseIpv4(value: string): number[] | null {
  const m = IPV4.exec(value.trim());
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

export function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export function buildFallbackAlert(input: ThreatMitigationAlertInput): ThreatMitigationAlertOutput {
  const sensors = [...(input.per_sensor_contributions ?? [])].sort((a, b) => b.z_score - a.z_score);
  const flagged = sensors.filter((s) => s.status !== 'normal');
  const drivers = (flagged.length ? flagged : sensors).slice(0, 2);

  const score =
    input.risk_score !== undefined
      ? `Detector risk score ${input.risk_score}/100`
      : `Detector anomaly score ${input.anomaly_score}`;
  const where = drivers.length
    ? `; largest deviations: ${drivers.map((s) => `${s.sensor} (z=${s.z_score.toFixed(1)})`).join(', ')}`
    : '';
  const summary =
    `${score}${where}. This is a rule-based assessment because the AI explanation is unavailable. ` +
    'Readings this far from baseline can come from a process fault, a failing sensor or manipulated ' +
    'sensor/control data; the data alone cannot tell which.';

  const actions: string[] = [];
  for (const s of drivers) if (SENSOR_ACTIONS[s.sensor]) actions.push(SENSOR_ACTIONS[s.sensor]);

  actions.push(
    'Confirm the reading at the field instrument or local HMI before acting. If the field value is normal, treat the remote data as untrusted (possible sensor spoofing) and escalate to your OT security contact.'
  );

  const ip = parseIpv4(input.network_traffic);
  if (ip && !isPrivateIpv4(ip)) {
    actions.push(
      `Review firewall and remote-access logs for traffic from ${ip.join('.')} (public address) and block it at the boundary if it is not an expected source.`
    );
  } else if (ip) {
    actions.push(`Check whether internal host ${ip.join('.')} is behaving as expected and review its recent connections.`);
  } else {
    actions.push('Review network logs for the reported traffic source.');
  }

  actions.push('Do not restart PLCs or override safety interlocks as a first response; follow your site incident procedure.');
  return { summary, suggestedActions: actions };
}
