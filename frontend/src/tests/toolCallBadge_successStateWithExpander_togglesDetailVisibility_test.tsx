import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallBadge } from '../components/ToolCallBadge';
import { ToolCallItem } from '../types';

describe('ToolCallBadge Expander', () => {
  it('toolCallBadge_successStateWithExpander_togglesDetailVisibility_test', () => {
    const mockTool: ToolCallItem = {
      id: 'tool-call-rename-456',
      name: 'renameProjectDocument',
      args: { title: 'Infosys' },
      result: { title: 'Infosys', updatedAt: '2026-10-16T13:59:15.679Z' },
      status: 'success',
    };

    const { unmount } = render(<ToolCallBadge tool={mockTool} />);

    try {
      const badge = screen.getByTestId('tool-call-badge');
      expect(badge).toBeDefined();
      expect(badge.textContent).toContain('Tool: renameProjectDocument');
      expect(badge.textContent).toContain('success');

      // Details should initially be collapsed for completed tool calls
      expect(screen.queryByTestId('tool-call-details')).toBeNull();

      // Click the expander button to reveal details
      const expanderBtn = screen.getByTestId('tool-call-expander');
      expect(expanderBtn.textContent).toContain('Details');
      fireEvent.click(expanderBtn);

      // Now details should be visible
      const details = screen.getByTestId('tool-call-details');
      expect(details).toBeDefined();
      expect(details.textContent).toContain('Parameters');
      expect(details.textContent).toContain('Result');
      expect(details.textContent).toContain('"title": "Infosys"');
      expect(expanderBtn.textContent).toContain('Hide');

      // Click the header to collapse details back
      const header = screen.getByTestId('tool-call-header');
      fireEvent.click(header);

      // Details should now be collapsed again
      expect(screen.queryByTestId('tool-call-details')).toBeNull();
      expect(expanderBtn.textContent).toContain('Details');
    } finally {
      unmount();
    }
  });
});
