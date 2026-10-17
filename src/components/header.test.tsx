import { fireEvent, render, screen } from '@testing-library/react';
import Header from '@/components/header';

describe('Header', () => {
  it('links to the case study', () => {
    render(<Header isAttackMode={false} onAttackModeChange={jest.fn()} onShowReport={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'Case study' })).toHaveAttribute('href', '/case-study');
    expect(screen.getByRole('link', { name: 'Offline replay' })).toHaveAttribute('href', '/offline-replay');
    expect(screen.getByRole('navigation', { name: 'Demo and evidence navigation' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'NEXUS' })).toHaveAttribute('src', '/nexus-wordmark.svg');
    expect(screen.getByText('Synthetic telemetry · no live PLC connection')).toBeInTheDocument();
  });

  it('keeps the attack switch and report button working', () => {
    const onAttackModeChange = jest.fn();
    const onShowReport = jest.fn();
    render(
      <Header isAttackMode={false} onAttackModeChange={onAttackModeChange} onShowReport={onShowReport} />
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Simulate Attack' }));
    expect(onAttackModeChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /View Report/ }));
    expect(onShowReport).toHaveBeenCalled();
  });
});
