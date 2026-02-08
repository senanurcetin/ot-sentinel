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

export default function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  return (
    <Card className="shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Real-time Analytics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="h-64">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Temperature (°C)</h3>
          <ChartContainer config={chartConfig} className="h-full w-full">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: -10 }}>
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
        </div>
        <div className="h-64">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Network Traffic (KB/s)</h3>
          <ChartContainer config={chartConfig} className="h-full w-full">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: -10 }}>
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
                domain={[0, 'dataMax + 1000']}
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
        </div>
      </CardContent>
    </Card>
  );
}
