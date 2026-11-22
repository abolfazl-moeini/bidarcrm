import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Root RTL & Accessibility', () => {
  it('renders root container with RTL direction and Persian language attribute', () => {
    const { container } = render(<App />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(root).toHaveAttribute('lang', 'fa');
  });

  it('renders BidarCRM brand identity', () => {
    render(<App />);
    const brandElements = screen.getAllByText(/بیدار|BidarCRM/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    expect(brandElements[0]).toBeInTheDocument();
  });
});
