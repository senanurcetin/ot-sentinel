import { fireEvent, render, screen, within } from '@testing-library/react';
import ForensicReportDialog from '@/components/forensic-report-dialog';
import type { LogEntry } from '@/lib/types';

const log = (over: Partial<LogEntry>): LogEntry => ({
  id: Math.random().toString(),
  timestamp: '2026-01-02T03:04:05.000Z',
  sourceIp: '10.0.0.5',
  payload: 'Status check OK',
  status: 'SECURE',
  ...over,
});

const logs: LogEntry[] = [
  log({ status: 'CRITICAL', sourceIp: '203.0.113.45', payload: 'ANOMALY DETECTED' }),
  log({ status: 'CRITICAL', sourceIp: '203.0.113.45', payload: 'ANOMALY DETECTED' }),
  log({ status: 'CRITICAL', sourceIp: '198.51.100.22', payload: '=HYPERLINK("x")' }),
  log({}),
];

// jsdom's Blob has no .text()
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // recharts: zero-size container
});
afterEach(() => jest.restoreAllMocks());

describe('ForensicReportDialog', () => {
  it('summarises totals, critical events and the most frequent attacker IP', () => {
    render(<ForensicReportDialog open onOpenChange={jest.fn()} logs={logs} />);
    const card = (title: string) => screen.getByText(title).parentElement!.parentElement!;
    expect(within(card('Total Events')).getByText('4')).toBeInTheDocument();
    expect(within(card('Critical Events')).getByText('3')).toBeInTheDocument();
    expect(within(card('Top Attacker IP')).getByText('203.0.113.45')).toBeInTheDocument();
  });

  it('downloads a CSV named for the report with a safe, quoted body', async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = jest.fn((b: Blob) => {
      blob = b;
      return 'blob:mock';
    });
    URL.revokeObjectURL = jest.fn();
    const clicked: HTMLAnchorElement[] = [];
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });

    render(<ForensicReportDialog open onOpenChange={jest.fn()} logs={logs} />);
    fireEvent.click(screen.getByRole('button', { name: /Download Report/ }));

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(/^otsentinel-forensic-report-.+\.csv$/);
    expect(clicked[0].getAttribute('href')).toBe('blob:mock');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    const text = await readBlob(blob!);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Timestamp,Status,Source IP,Payload');
    expect(lines).toHaveLength(5);
    expect(text).toContain(`"'=HYPERLINK(""x"")"`); // formula neutralised, quotes escaped
  });

  it('does not download anything when there are no logs', () => {
    URL.createObjectURL = jest.fn();
    render(<ForensicReportDialog open onOpenChange={jest.fn()} logs={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Download Report/ }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('calls onOpenChange(false) from Close', () => {
    const onOpenChange = jest.fn();
    render(<ForensicReportDialog open onOpenChange={onOpenChange} logs={logs} />);
    // The dialog has an icon-only close (sr-only label) and a footer Close button; use the footer one.
    const footerClose = screen
      .getAllByRole('button', { name: 'Close' })
      .find((b) => !b.querySelector('.sr-only'))!;
    fireEvent.click(footerClose);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
