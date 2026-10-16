import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallBadge } from '../components/ToolCallBadge';
import { ToolCallItem } from '../types';

describe('ToolCallBadge', () => {
  it('toolCallBadge_executingState_showsExecutingBadge_test', () => {
    const mockTool: ToolCallItem = {
      id: 'tool-call-123',
      name: 'updateStatus',
      args: { status: 'completed' },
      status: 'executing',
    };

    const { unmount } = render(<ToolCallBadge tool={mockTool} />);

    try {
      const badge = screen.getByTestId('tool-call-badge');
      expect(badge).toBeDefined();
      expect(badge.textContent).toContain('Tool: updateStatus');
      expect(badge.textContent).toContain('executing');
      expect(badge.textContent).toContain('"status": "completed"');
    } finally {
      unmount();
    }
  });
});
