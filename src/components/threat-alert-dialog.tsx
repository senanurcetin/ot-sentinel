'use client';

import { generateThreatMitigationAlert, ThreatMitigationAlertInput, ThreatMitigationAlertOutput } from '@/ai/flows/threat-mitigation-alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useEffect, useState } from 'react';
import { AlertTriangle, ListChecks, ShieldCheck, Activity } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

type ThreatAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threatData: ThreatMitigationAlertInput | null;
};

export default function ThreatAlertDialog({ open, onOpenChange, threatData }: ThreatAlertDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThreatMitigationAlertOutput | null>(null);

  useEffect(() => {
    if (open && threatData && !result) {
      const getAlert = async () => {
        setLoading(true);
        try {
          const aiResult = await generateThreatMitigationAlert(threatData);
          setResult(aiResult);
        } catch (error) {
          console.error('Failed to get AI threat mitigation alert:', error);
          setResult({
            summary: "An error occurred while generating the AI summary. Please check the logs and network status manually.",
            suggestedActions: ["Isolate the affected network segment immediately.", "Review firewall logs for the source IP.", "Perform a system scan on the affected PLCs."]
          })
        } finally {
          setLoading(false);
        }
      };
      getAlert();
    }
    if (!open) {
      // Reset state when dialog is closed
      setTimeout(() => {
        setResult(null);
        setLoading(false);
      }, 300);
    }
  }, [open, threatData, result]);

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
                <p className="text-muted-foreground bg-muted p-3 rounded-md">{result?.summary}</p>
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
          <AlertDialogAction 
            onClick={() => onOpenChange(false)} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Acknowledge & Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
