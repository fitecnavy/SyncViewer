import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock GoogleAuth component
vi.mock('./components/Auth/GoogleAuth', () => ({
  default: () => (
    <div data-testid="google-auth">Google Auth Component</div>
  ),
}));

// Mock Library component
vi.mock('./components/Library/Library', () => ({
  default: () => <div data-testid="library">Library Component</div>,
}));

// Mock TextViewer component
vi.mock('./components/TextViewer/TextViewer', () => ({
  default: () => <div data-testid="text-viewer">Text Viewer Component</div>,
}));

describe('App', () => {
  it('renders GoogleAuth component when not authenticated', () => {
    render(<App />);
    expect(screen.getByTestId('google-auth')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
