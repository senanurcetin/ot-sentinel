'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

type ChartDataPoint = {
  time: string;
  temp?: number;
  traffic?: number;
};

type AnalyticsChartsProps = {
  data: ChartDataPoint[];
  connectionState: 'connecting' | 'active' | 'unavailable';
};

const chartConfig = {
  temp: {
    label: 'Temperature',
    color: 'hsl(var(--chart-2))',
  },
  traffic: {
    label: 'Traffic',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const formatTime = (time: string) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});

export default function AnalyticsCharts({ data, connectionState }: AnalyticsChartsProps) {
  return (
    <Card className="nexus-panel h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">{connectionState === 'unavailable' ? 'Historical Analytics' : 'Real-time Analytics'}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {connectionState === 'unavailable'
                ? 'Historical simulated readings · stream interrupted'
                : 'Simulated telemetry · latest 60 monitoring samples'}
            </p>
          </div>
          <span className="nexus-chart-count" data-state={connectionState} aria-label={`${data.length} telemetry samples received`}>
            {data.length} samples
          </span>
        </div>
      </CardHeader>
      <CardContent className="nexus-chart-surface grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex h-64 min-h-0 flex-col">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Temperature (°C)</h3>
          {data.length === 0 ? (
            <div className="nexus-chart-placeholder" role="status">
              {connectionState === 'unavailable' ? 'Temperature telemetry unavailable' : 'Waiting for temperature samples'}
            </div>
          ) : (
          <ChartContainer config={chartConfig} className="min-h-0 w-full flex-1 !aspect-auto">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatTime}
                className='text-xs'
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => `${value}°`}
                className='text-xs'
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Line
                dataKey="temp"
                type="monotone"
                stroke="var(--color-temp)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
          )}
        </div>
        <div className="flex h-64 min-h-0 flex-col">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Network Traffic (KB/s)</h3>
          {data.length === 0 ? (
            <div className="nexus-chart-placeholder" role="status">
              {connectionState === 'unavailable' ? 'Network telemetry unavailable' : 'Waiting for network samples'}
            </div>
          ) : (
          <ChartContainer config={chartConfig} className="min-h-0 w-full flex-1 !aspect-auto">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatTime}
                className='text-xs'
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, (maximum: number) => Math.max(10, Math.ceil(maximum * 1.15))]}
                 className='text-xs'
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Line
                dataKey="traffic"
                type="monotone"
                stroke="var(--color-traffic)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
