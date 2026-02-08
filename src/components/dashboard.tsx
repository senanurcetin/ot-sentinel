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

const MAX_CHART_POINTS = 60;
const MAX_LOG_ENTRIES = 100;
const ALERT_COOLDOWN_MS = 5000; // 5 seconds

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<{ time: string; temp?: number; traffic?: number }[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAttackMode, setAttackMode] = useState(false);
  
  const [activeThreats, setActiveThreats] = useState(0);
  const [showThreatAlert, setShowThreatAlert] = useState(false);
  const [alertCooldown, setAlertCooldown] = useState(false);
  const { toast } = useToast();

  const showThreatAlertRef = useRef(showThreatAlert);
  showThreatAlertRef.current = showThreatAlert;

  const alertCooldownRef = useRef(alertCooldown);
  alertCooldownRef.current = alertCooldown;

  const handleAttackModeChange = (checked: boolean) => {
    setAttackMode(checked);
    toast({
      title: `Attack Simulation ${checked ? 'Enabled' : 'Disabled'}`,
      description: `The system is now ${checked ? 'simulating an attack' : 'in normal operation'}.`,
      variant: checked ? 'destructive' : 'default',
    });
    if (!checked) {
      setActiveThreats(0); // Reset threats when turning off simulation
    }
  };
  
  const processNewMetrics = useCallback((newMetrics: Metrics) => {
    // If attack mode is off, but we receive a CRITICAL metric, ignore it.
    // This prevents the UI from showing an attack right after the user turned it off.
    if (!isAttackMode && newMetrics.status === 'CRITICAL') {
      return;
    }
    
    setMetrics(newMetrics);

    setChartData((prev) => [
      ...prev.slice(prev.length > MAX_CHART_POINTS ? 1 : 0),
      {
        time: newMetrics.timestamp,
        temp: newMetrics.metrics.temp,
        traffic: newMetrics.traffic_volume,
      },
    ]);

    const newLog: LogEntry = {
      id: newMetrics.timestamp + Math.random(),
      timestamp: newMetrics.timestamp,
      sourceIp: newMetrics.network_traffic,
      payload: newMetrics.log_entry,
      status: newMetrics.status,
    };

    setLogs((prev) => [newLog, ...prev].slice(0, MAX_LOG_ENTRIES));
    
    if (newMetrics.status === 'CRITICAL' && !showThreatAlertRef.current && !alertCooldownRef.current) {
        setActiveThreats(prev => prev + 1);
        setShowThreatAlert(true);
    }
  }, [isAttackMode]);

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
    return () => clearInterval(intervalId);
  }, [processNewMetrics, isAttackMode]);

  const exportData = () => {
    const header = "timestamp,status,source_ip,payload\n";
    const csv = logs
        .map(l => `"${l.timestamp}","${l.status}","${l.sourceIp}","${l.payload.replace(/"/g, '""')}"`)
        .join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `otsentinel_forensic_data_${new Date().toISOString()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
     toast({
        title: 'Export Started',
        description: 'Your forensic data is being downloaded.',
      });
  };

  const handleAlertOpenChange = (isOpen: boolean) => {
    setShowThreatAlert(isOpen);
    if (!isOpen) {
      // When dialog is closed, start a cooldown period.
      setAlertCooldown(true);
      setTimeout(() => {
        setAlertCooldown(false);
      }, ALERT_COOLDOWN_MS);
    }
  };

  const systemStatus = metrics?.status || 'UNKNOWN';
  const aiConfidence = metrics ? `${(100 - metrics.anomaly_score * 100).toFixed(1)}%` : 'N/A';

  const threatDataForAI = metrics ? {
      ...metrics,
      // The AI flow doesn't know about traffic_volume, so we exclude it.
      traffic_volume: undefined, 
  } : null;

  return (
    <div className="flex h-screen w-full flex-col bg-background font-body">
      <Header 
        isAttackMode={isAttackMode} 
        onAttackModeChange={handleAttackModeChange} 
        onExport={exportData}
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
    </div>
  );
}
