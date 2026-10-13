'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

type NetworkTopologyProps = {
  status: 'SECURE' | 'CRITICAL' | 'UNKNOWN';
};

/** Conceptual demo route; node labels do not imply discovered plant assets. */
export default function NetworkTopology({ status }: NetworkTopologyProps) {
  const isCritical = status === 'CRITICAL';
  const isNominal = status === 'SECURE';
  const verdictLabel = isCritical ? 'CRITICAL DETECTOR STATE'
    : isNominal ? 'NOMINAL DETECTOR STATE' : 'DETECTOR STATUS PENDING';

  const nodeColor = isCritical ? '#ff8fa1' : isNominal ? '#6de2b7' : '#82b7e9';
  const pathColor = isCritical ? '#f37a88' : isNominal ? '#4ea8ff' : '#496886';

  return (
    <Card className="nexus-panel nexus-map-card h-full">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Network Topology</h2>
            <p className="mt-1 text-xs text-muted-foreground">Conceptual OT route · illustrative, not discovered assets</p>
          </div>
          <span className="nexus-map-verdict" data-status={status} role="status">
            <span className="nexus-map-led" aria-hidden="true" />{verdictLabel}
          </span>
        </div>
        {status === 'UNKNOWN' && (
          <p className="text-xs text-muted-foreground">Topology status pending telemetry</p>
        )}
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="nexus-map-viewport" tabIndex={0} role="region" aria-label="Scrollable illustrative network map">
          <svg className="nexus-map-svg" viewBox="0 0 470 176" role="img"
            aria-label={`Simulated Internet, firewall, gateway and two PLCs. Detector state: ${status}.`}>
            <defs>
              <linearGradient id="nexus-map-panel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#173858" />
                <stop offset="1" stopColor="#0b233d" />
              </linearGradient>
              <pattern id="nexus-map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#456789" strokeWidth="0.4" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="470" height="176" rx="13" fill="#091d32" />
            <rect x="1" y="1" width="468" height="174" rx="12" fill="url(#nexus-map-grid)" stroke="#2e5273" strokeWidth="1" />
            <text x="18" y="22" fontSize="9" letterSpacing="1.5" fill="#82b7e9">NEXUS / CONCEPTUAL NETWORK MAP</text>
            <text x="451" y="22" textAnchor="end" fontSize="9" fill="#9bb5d2">SIMULATED</text>

            <g fill="none" stroke={pathColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 88 86 L 128 86" />
              <path d="M 198 86 L 236 86" />
              <path d="M 306 86 L 326 86 L 326 61 L 360 61" />
              <path d="M 326 86 L 326 117 L 360 117" />
            </g>
            {[54, 164, 272, 397, 397].map((x, index) => {
              const y = index === 3 ? 61 : index === 4 ? 117 : 86;
              return (
                <g key={index}>
                  <rect x={x - 34} y={y - 25} width="68" height="52" rx="10"
                    fill="url(#nexus-map-panel)" stroke={index > 2 ? '#315576' : nodeColor} strokeWidth="1.3" />
                  <rect x={x - 26} y={y - 17} width="52" height="36" rx="6"
                    fill="rgba(78,168,255,0.06)" />
                </g>
              );
            })}
            {/* Native SVG strokes remain visible in browsers that do not render
                HTML/Lucide nodes inside SVG foreignObject elements. */}
            <g className="nexus-map-icon" fill="none" stroke={nodeColor} strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="54" cy="86" r="14" />
              <path d="M40 86h28M54 72c-8 6-8 22 0 28M54 72c8 6 8 22 0 28M42 80h24M42 92h24" />
              <path d="M164 71l13 5v10c0 9-6 14-13 17-7-3-13-8-13-17V76z" />
              <path d="M158 86l4 4 9-10" />
              <rect x="258" y="76" width="28" height="18" rx="4" />
              <path d="M262 99h20M272 94v5M263 82h5M272 82h9" />
              <rect x="385" y="51" width="24" height="20" rx="3" />
              <path d="M390 56h8M390 62h13" />
              <circle cx="405" cy="56" r="1" fill={nodeColor} stroke="none" />
              <rect x="385" y="107" width="24" height="20" rx="3" />
              <path d="M390 112h8M390 118h13" />
              <circle cx="405" cy="112" r="1" fill={nodeColor} stroke="none" />
            </g>
            {[
              ['Internet', 54, 131], ['Firewall', 164, 131], ['Gateway', 272, 131],
              ['PLC 01', 397, 103], ['PLC 02', 397, 158],
            ].map(([name, x, y]) => (
              <text key={String(name)} x={x} y={y} textAnchor="middle"
                fontSize="10" fontWeight="600" fill="#d2e4f9">{name}</text>
            ))}
            {isCritical && <g fill="#f37a88">
              <circle className="nexus-map-pulse" cx="109" cy="86" r="4" />
              <circle className="nexus-map-pulse" cx="218" cy="86" r="4" />
            </g>}
          </svg>
        </div>
        <div className="nexus-map-footer">
          <span><span className="nexus-map-key" style={{ background: pathColor }} /> Monitored path (illustrative)</span>
          <span className="inline-flex items-center gap-1"><ArrowRight size={12} /> Detector: {status}</span>
        </div>
      </CardContent>
    </Card>
  );
}
