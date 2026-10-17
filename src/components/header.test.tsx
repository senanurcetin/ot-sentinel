import { fireEvent, render, screen } from '@testing-library/react';
import Header from '@/components/header';

describe('Header', () => {
  it('renders the official local NEXUS X mark in the application header', () => {
    const { container } = render(<Header isAttackMode={false} onAttackModeChange={jest.fn()} onShowReport={jest.fn()} />);
    const mark = container.querySelector('img[src="/nexus-x.svg"]');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('alt', '');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { name: 'OT-Sentinel' })).toBeInTheDocument();
  });

  it('links to the case study', () => {
    render(<Header isAttackMode={false} onAttackModeChange={jest.fn()} onShowReport={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'Case study' })).toHaveAttribute('href', '/case-study');
    expect(screen.getByRole('link', { name: 'Offline replay' })).toHaveAttribute('href', '/offline-replay');
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
