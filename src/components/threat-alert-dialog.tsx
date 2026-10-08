'use client';

import { generateThreatMitigationAlert } from '@/ai/flows/threat-mitigation-alert';
import type {
  ThreatMitigationAlertInput,
  ThreatMitigationAlertResult,
} from '@/lib/types';
import { buildFallbackAlert } from '@/lib/fallback-mitigation';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ListChecks, ShieldCheck, Activity } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Button } from '@/components/ui/button';

/** The verdict plus the detector context, so false-alarm rates can be reported per sensor. */
export function feedbackBody(
  threat: ThreatMitigationAlertInput,
  verdict: 'confirmed_threat' | 'false_alarm'
) {
  const top = [...(threat.per_sensor_contributions ?? [])].sort(
    (a, b) => b.contribution_pct - a.contribution_pct
  )[0];
  return {
    timestamp: threat.timestamp,
    verdict,
    ...(threat.risk_score !== undefined && { risk_score: threat.risk_score }),
    ...(top && { top_sensor: top.sensor }),
  };
}

async function sendFeedback(
  threat: ThreatMitigationAlertInput,
  verdict: 'confirmed_threat' | 'false_alarm'
) {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackBody(threat, verdict)),
    });
  } catch (error) {
    console.error('Failed to send alert feedback:', error);
  }
}

type ThreatAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threatData: ThreatMitigationAlertInput | null;
};

export default function ThreatAlertDialog({ open, onOpenChange, threatData }: ThreatAlertDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThreatMitigationAlertResult | null>(null);

  // Telemetry updates every second, which hands this component a new `threatData` object each
  // time. Without this guard the effect would re-request the AI explanation on every update
  // until the first response arrived. One request per time the dialog opens; stale responses
  // (dialog closed or reopened meanwhile) are dropped via the request id.
  const requestId = useRef(0);
  const requested = useRef(false);

  useEffect(() => {
    if (open && threatData && !requested.current) {
      requested.current = true;
      const id = ++requestId.current;
      setLoading(true);
      generateThreatMitigationAlert(threatData)
        .then((aiResult) => {
          if (requestId.current === id) setResult(aiResult);
        })
        .catch((error) => {
          console.error('Failed to get AI threat mitigation alert:', error);
          if (requestId.current === id) {
            // The server action itself failed (network, deployment): same rule-based guidance.
            setResult({ ...buildFallbackAlert(threatData), source: 'fallback' });
          }
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }

    if (!open) {
      requested.current = false;
      requestId.current += 1; // invalidate any in-flight request
      // Keep the content visible while the close animation plays, then reset.
      const timer = setTimeout(() => {
        setResult(null);
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, threatData]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-2xl text-rose-500">
            <AlertTriangle className="h-8 w-8" />
            CRITICAL THREAT DETECTED
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2 text-base text-muted-foreground">
            A high-priority anomaly has been identified by the AI engine. Immediate attention is required.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="my-4 space-y-6">
          <div className="space-y-3">
             <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Activity className="h-5 w-5 text-primary" />
                Threat Summary
            </h3>
            {loading ? (
                <div className='space-y-2'>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            ) : (
                <>
                  <p className="text-muted-foreground bg-muted p-3 rounded-md">{result?.summary}</p>
                  {result?.source === 'fallback' && (
                    <p className="text-xs text-amber-500" role="note">
                      AI explanation unavailable — showing rule-based guidance.
                    </p>
                  )}
                </>
            )}
          </div>
          <div className="space-y-3">
             <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <ListChecks className="h-5 w-5 text-primary" />
                Suggested Mitigation Actions
            </h3>
            {loading ? (
                 <div className='space-y-2'>
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/6" />
                </div>
            ) : (
                <ul className="space-y-2">
                    {result?.suggestedActions.map((action, index) => (
                        <li key={index} className="flex items-start gap-3">
                            <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{action}</span>
                        </li>
                    ))}
                </ul>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (threatData) void sendFeedback(threatData, 'false_alarm');
              onOpenChange(false);
            }}
          >
            Mark as false alarm
          </Button>
          <AlertDialogAction 
            onClick={() => {
              if (threatData) void sendFeedback(threatData, 'confirmed_threat');
              onOpenChange(false);
            }} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Confirm threat & close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
