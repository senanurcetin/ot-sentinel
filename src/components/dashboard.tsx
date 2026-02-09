'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Metrics, LogEntry } from '@/lib/types';
import Header from '@/components/header';
import MetricCard from '@/components/metric-card';
import NetworkTopology from '@/components/network-topology';
import AnalyticsCharts from '@/components/analytics-charts';
import AuditLog from '@/components/audit-log';
import ThreatAlertDialog from '@/components/threat-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, Gauge, Thermometer, Waves, Activity } from 'lucide-react';
import type { ThreatMitigationAlertInput } from '@/ai/flows/threat-mitigation-alert';
import ForensicReportDialog from './forensic-report-dialog';

/**
 * The maximum number of data points to display on the charts.
 */
const MAX_CHART_POINTS = 60;

/**
 * The maximum number of log entries to store and display.
 */
const MAX_LOG_ENTRIES = 100;

/**
 * The cooldown period in milliseconds before showing another threat alert.
 */
const ALERT_COOLDOWN_MS = 5000;

/**
 * The main dashboard component for the OT-Sentinel application.
 * It orchestrates data fetching, state management, and renders all sub-components.
 */
export default function Dashboard() {
  // Core state for the latest metrics received from the API
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  // State for time-series data for the analytics charts
  const [chartData, setChartData] = useState<{ time: string; temp?: number; traffic?: number }[]>([]);
  // State for the audit log entries
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // State to control the "Simulate Attack" mode
  const [isAttackMode, setAttackMode] = useState(false);
  
  // State to track the number of threats detected in the current session
  const [activeThreats, setActiveThreats] = useState(0);
  // State to control the visibility of the threat alert dialog
  const [showThreatAlert, setShowThreatAlert] = useState(false);
  const [showForensicReport, setShowForensicReport] = useState(false);
  // State to manage the cooldown period for showing alerts
  const [alertCooldown, setAlertCooldown] = useState(false);
  const { toast } = useToast();

  // Refs to get the current value of state within callbacks without causing re-renders
  const showThreatAlertRef = useRef(showThreatAlert);
  showThreatAlertRef.current = showThreatAlert;

  const alertCooldownRef = useRef(alertCooldown);
  alertCooldownRef.current = alertCooldown;

  /**
   * Toggles the attack simulation mode on and off.
   * @param checked - The new state of the attack mode switch.
   */
  const handleAttackModeChange = (checked: boolean) => {
    setAttackMode(checked);
    toast({
      title: `Attack Simulation ${checked ? 'Enabled' : 'Disabled'}`,
      description: `The system is now ${checked ? 'simulating an attack' : 'in normal operation'}.`,
      variant: checked ? 'destructive' : 'default',
    });
    // Reset threat count when attack mode is disabled
    if (!checked) {
      setActiveThreats(0);
    }
  };
  
  /**
   * Processes new metrics data received from the API.
   * Updates chart data, logs, and triggers threat alerts if necessary.
   * This function is memoized with useCallback to prevent unnecessary re-creations.
   * @param newMetrics - The latest metrics data object.
   */
  const processNewMetrics = useCallback((newMetrics: Metrics) => {
    setMetrics(newMetrics);

    // Update chart data, keeping it within MAX_CHART_POINTS
    setChartData((prev) => [
      ...prev.slice(prev.length >= MAX_CHART_POINTS ? 1 : 0),
      {
        time: newMetrics.timestamp,
        temp: newMetrics.metrics.temp,
        traffic: newMetrics.traffic_volume,
      },
    ]);

    // Create and prepend a new log entry, keeping the list within MAX_LOG_ENTRIES
    const newLog: LogEntry = {
      id: newMetrics.timestamp + Math.random(),
      timestamp: newMetrics.timestamp,
      sourceIp: newMetrics.network_traffic,
      payload: newMetrics.log_entry,
      status: newMetrics.status,
    };

    setLogs((prev) => [newLog, ...prev].slice(0, MAX_LOG_ENTRIES));
    
    // Trigger a threat alert if a critical event occurs and we're not in a cooldown period.
    if (newMetrics.status === 'CRITICAL' && !showThreatAlertRef.current && !alertCooldownRef.current) {
        setActiveThreats(prev => prev + 1);
        setShowThreatAlert(true);
    }
  }, []);

  /**
   * Sets up an interval to fetch metrics data from the API every second.
   * The attack mode status is passed as a query parameter to the API.
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/metrics?attack=${isAttackMode}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data: Metrics = await response.json();
        processNewMetrics(data);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    const intervalId = setInterval(fetchData, 1000);
    // Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [processNewMetrics, isAttackMode]);

  /**
   * Handles the opening and closing of the threat alert dialog.
   * When the dialog is closed, it initiates a cooldown period.
   * @param isOpen - The new state of the dialog.
   */
  const handleAlertOpenChange = (isOpen: boolean) => {
    setShowThreatAlert(isOpen);
    // When the dialog is closed, start the cooldown
    if (!isOpen) {
      setAlertCooldown(true);
      setTimeout(() => {
        setAlertCooldown(false);
      }, ALERT_COOLDOWN_MS);
    }
  };

  // Derived state for system status and AI confidence score
  const systemStatus = metrics?.status || 'UNKNOWN';
  const aiConfidence = metrics ? `${(100 - metrics.anomaly_score * 100).toFixed(1)}%` : 'N/A';

  // Prepare the data to be sent to the AI for analysis, removing unnecessary fields.
  const threatDataForAI: ThreatMitigationAlertInput | null = metrics
    ? {
        timestamp: metrics.timestamp,
        metrics: metrics.metrics,
        network_traffic: metrics.network_traffic,
        status: metrics.status,
        anomaly_score: metrics.anomaly_score,
        log_entry: metrics.log_entry,
      }
    : null;

  return (
    <div className="flex h-screen w-full flex-col bg-background font-body">
      <Header 
        isAttackMode={isAttackMode} 
        onAttackModeChange={handleAttackModeChange} 
        onShowReport={() => setShowForensicReport(true)}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="mx-auto w-full space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              title="System Status"
              value={systemStatus}
              icon={systemStatus === 'SECURE' ? ShieldCheck : ShieldAlert}
              valueClassName={systemStatus === 'SECURE' ? 'text-emerald-500' : 'text-rose-500'}
              description={systemStatus === 'SECURE' ? 'All systems nominal' : 'Anomaly detected!'}
              className="xl:col-span-2"
            />
             <MetricCard
              title="Temperature"
              value={`${metrics?.metrics.temp.toFixed(1) ?? 'N/A'} °C`}
              icon={Thermometer}
              valueClassName={metrics && metrics.metrics.temp > 80 ? 'text-rose-500' : 'text-foreground'}
            />
            <MetricCard
              title="Vibration"
              value={`${metrics?.metrics.vibration.toFixed(3) ?? 'N/A'} g`}
              icon={Waves}
               valueClassName={metrics && metrics.metrics.vibration > 0.5 ? 'text-rose-500' : 'text-foreground'}
            />
            <MetricCard
              title="AI Confidence"
              value={aiConfidence}
              icon={Gauge}
              description="Confidence in 'Secure' status"
            />
            <MetricCard
              title="Active Threats"
              value={activeThreats}
              icon={Activity}
              description="Critical events in this session"
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <NetworkTopology status={systemStatus as 'SECURE' | 'CRITICAL'} />
            </div>
            <div className="lg:col-span-3">
              <AnalyticsCharts data={chartData} />
            </div>
          </div>
          <div>
            <AuditLog logs={logs} />
          </div>
        </div>
      </main>
      <ThreatAlertDialog 
        open={showThreatAlert} 
        onOpenChange={handleAlertOpenChange}
        threatData={threatDataForAI}
      />
      <ForensicReportDialog
        open={showForensicReport}
        onOpenChange={setShowForensicReport}
        logs={logs}
      />
    </div>
  );
}
