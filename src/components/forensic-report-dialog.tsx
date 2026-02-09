'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { LogEntry } from '@/lib/types';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useMemo } from 'react';
import { FileSearch, AlertCircle, CheckCircle, List, Download } from 'lucide-react';

type ForensicReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: LogEntry[];
};

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--chart-1))']; // Red for CRITICAL, Green for SECURE

export default function ForensicReportDialog({ open, onOpenChange, logs }: ForensicReportDialogProps) {
  const analysis = useMemo(() => {
    if (!logs || logs.length === 0) {
      return {
        totalEvents: 0,
        criticalEvents: 0,
        secureEvents: 0,
        attackerIps: {},
        pieData: [],
        topAttacker: 'N/A',
      };
    }

    const criticalEvents = logs.filter((log) => log.status === 'CRITICAL');
    const secureEvents = logs.length - criticalEvents.length;

    const attackerIps = criticalEvents.reduce((acc, log) => {
      acc[log.sourceIp] = (acc[log.sourceIp] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topAttacker = Object.entries(attackerIps).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    const pieData = [
      { name: 'Critical', value: criticalEvents.length },
      { name: 'Secure', value: secureEvents },
    ].filter(item => item.value > 0);

    return {
      totalEvents: logs.length,
      criticalEvents: criticalEvents.length,
      secureEvents: secureEvents,
      attackerIps,
      pieData,
      topAttacker,
    };
  }, [logs]);

  const handleDownloadCsv = () => {
    if (!logs || logs.length === 0) {
      return;
    }

    const headers = ['Timestamp', 'Status', 'Source IP', 'Payload'];
    
    const csvRows = logs.map(log => {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.status,
        log.sourceIp,
        log.payload,
      ];
      return row
        .map(field => {
          const stringField = String(field ?? '').replace(/"/g, '""');
          return `"${stringField}"`;
        })
        .join(',');
    });

    const csvString = [headers.join(','), ...csvRows].join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `otsentinel-forensic-report-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FileSearch className="h-7 w-7" />
            Forensic Analysis Report
          </DialogTitle>
          <DialogDescription>
            An overview of the latest {analysis.totalEvents} security events recorded in the system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 flex-1 overflow-y-auto pr-2 pt-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 px-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                <List className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.totalEvents}</div>
                <p className="text-xs text-muted-foreground">Total logged events</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{analysis.criticalEvents}</div>
                <p className="text-xs text-muted-foreground">Potential threats detected</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Secure Events</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">{analysis.secureEvents}</div>
                <p className="text-xs text-muted-foreground">Normal operations</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Attacker IP</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-code">{analysis.topAttacker}</div>
                <p className="text-xs text-muted-foreground">Most frequent critical source</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart and Table */}
          <div className="grid gap-6 md:grid-cols-5 px-2">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Event Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                 <PieChart width={250} height={250}>
                    <Pie
                      data={analysis.pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {analysis.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                      <Tooltip
                        contentStyle={{
                            background: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)"
                        }}
                      />
                      <Legend />
                  </PieChart>
              </CardContent>
            </Card>
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Detailed Audit Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72 w-full">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead className="w-[100px]">Time</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[120px]">Source IP</TableHead>
                        <TableHead>Payload</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="font-code text-xs">
                           <TableCell>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                           </TableCell>
                           <TableCell>
                            <Badge variant={log.status === 'CRITICAL' ? 'destructive' : 'secondary'}>
                              {log.status}
                            </Badge>
                           </TableCell>
                           <TableCell>{log.sourceIp}</TableCell>
                           <TableCell>{log.payload}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleDownloadCsv}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
