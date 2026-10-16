import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../components/Header';

describe('Header', () => {
  it('header_renderedState_displaysCleanBrandAndSupervisorBadge_test', () => {
    const { unmount } = render(<Header />);

    try {
      const header = screen.getByTestId('header');
      expect(header).toBeDefined();
      expect(screen.getByText('SCRIPTORIUM')).toBeDefined();
      expect(screen.getByText('Supervisor')).toBeDefined();

      // Verify redundant IDs and indicators are removed to declutter the UI
      expect(screen.queryByTestId('firestore-status')).toBeNull();
      expect(screen.queryByText('Firestore Live')).toBeNull();
      expect(screen.queryByText(/Project:/i)).toBeNull();
      expect(screen.queryByText(/scriptorium-503507/i)).toBeNull();
      expect(screen.queryByText(/Supervisor MVP/i)).toBeNull();
    } finally {
      unmount();
    }
  });
});
