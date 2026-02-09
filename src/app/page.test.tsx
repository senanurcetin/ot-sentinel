import { render, screen } from '@testing-library/react'
import Home from './page'
import '@testing-library/jest-dom'

// The dashboard component makes API calls in a useEffect and uses browser APIs not available in JSDOM.
// We can mock some of the browser APIs it uses to prevent errors.
beforeAll(() => {
  // Mock fetch API
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        timestamp: new Date().toISOString(),
        metrics: {
          temp: 50,
          pressure: 1010,
          vibration: 0.05,
        },
        network_traffic: '192.168.1.10',
        traffic_volume: 100,
        status: 'SECURE',
        anomaly_score: 0.1,
        log_entry: 'Status check OK',
      }),
    })
  ) as jest.Mock;

  // Mocking for recharts library which uses ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});
 
describe('Home Page', () => {
  it('should render the main heading', async () => {
    render(<Home />)
 
    // The Dashboard component will be rendered, which in turn renders the Header
    // We check for the main title of the application.
    const heading = await screen.findByRole('heading', { name: /OT-Sentinel/i });
 
    expect(heading).toBeInTheDocument();
  })
})
