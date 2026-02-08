'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Globe, Shield, Router, Server } from 'lucide-react';

type NetworkTopologyProps = {
  status: 'SECURE' | 'CRITICAL';
};

export default function NetworkTopology({ status }: NetworkTopologyProps) {
  const isAttack = status === 'CRITICAL';

  const connectionColor = isAttack ? 'stroke-rose-500' : 'stroke-slate-300';
  const iconColor = 'text-slate-600';
  const attackIconColor = 'text-rose-500';

  return (
    <Card className="shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Network Topology</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <svg width="100%" height="150" viewBox="0 0 400 150">
          {/* Icons and Labels */}
          <g transform="translate(40, 75)">
            <foreignObject x="-16" y="-16" width="32" height="32">
              <Globe className={cn(iconColor, isAttack && attackIconColor)} size={32} />
            </foreignObject>
            <text x="0" y="35" textAnchor="middle" fontSize="12" fill="currentColor" className="font-sans text-slate-700">Internet</text>
          </g>
          <g transform="translate(120, 75)">
            <foreignObject x="-16" y="-16" width="32" height="32">
              <Shield className={cn(iconColor, isAttack && attackIconColor)} size={32} />
            </foreignObject>
            <text x="0" y="35" textAnchor="middle" fontSize="12" fill="currentColor" className="font-sans text-slate-700">Firewall</text>
          </g>
          <g transform="translate(200, 75)">
            <foreignObject x="-16" y="-16" width="32" height="32">
              <Router className={cn(iconColor, isAttack && attackIconColor)} size={32} />
            </foreignObject>
            <text x="0" y="35" textAnchor="middle" fontSize="12" fill="currentColor" className="font-sans text-slate-700">Gateway</text>
          </g>
          <g transform="translate(280, 45)">
            <foreignObject x="-12" y="-12" width="24" height="24">
              <Server className={cn(iconColor)} size={24} />
            </foreignObject>
            <text x="0" y="30" textAnchor="middle" fontSize="12" fill="currentColor" className="font-sans text-slate-700">PLC 1</text>
          </g>
           <g transform="translate(280, 105)">
            <foreignObject x="-12" y="-12" width="24" height="24">
              <Server className={cn(iconColor)} size={24} />
            </foreignObject>
            <text x="0" y="30" textAnchor="middle" fontSize="12" fill="currentColor" className="font-sans text-slate-700">PLC 2</text>
          </g>
          
          {/* Connections */}
          <path d="M 56 75 L 104 75" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />
          <path d="M 136 75 L 184 75" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />
          
          {/* Forked Connection */}
          <path d="M 216 75 L 240 75" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />
          <path d="M 240 75 L 240 45" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />
          <path d="M 240 75 L 240 105" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />

          <path d="M 240 45 L 268 45" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />
          <path d="M 240 105 L 268 105" className={cn("transition-all duration-500", connectionColor)} strokeWidth="2" fill="none" />

          {isAttack && (
             <g>
                <circle cx="80" cy="75" r="3" fill="currentColor" className="text-rose-500 animate-ping"/>
                <circle cx="160" cy="75" r="3" fill="currentColor" className="text-rose-500 animate-ping" style={{animationDelay: '0.2s'}}/>
                <circle cx="240" cy="75" r="3" fill="currentColor" className="text-rose-500 animate-ping" style={{animationDelay: '0.4s'}}/>
             </g>
          )}

        </svg>
      </CardContent>
    </Card>
  );
}
