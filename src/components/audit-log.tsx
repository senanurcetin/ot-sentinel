'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LogEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type AuditLogProps = {
  logs: LogEntry[];
};

export default function AuditLog({ logs }: AuditLogProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Audit Log</CardTitle>
        <span className="text-xs text-muted-foreground">Showing last {logs.length} events</span>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 w-full">
          <Table>
            <TableHeader className='sticky top-0 bg-card'>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[150px]">Source IP</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="font-code text-xs">
                  <TableCell>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}.{new Date(log.timestamp).getMilliseconds().toString().padStart(3, '0')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.status === 'CRITICAL' ? 'destructive' : 'secondary'}
                    >
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
  );
}
