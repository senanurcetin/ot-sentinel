import { fireEvent, render, screen } from '@testing-library/react';
import Header from '@/components/header';

describe('Header', () => {
  it('links to the case study', () => {
    render(<Header isAttackMode={false} onAttackModeChange={jest.fn()} onShowReport={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'Case study' })).toHaveAttribute('href', '/case-study');
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
