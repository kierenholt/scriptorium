import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectViewer } from '../components/ProjectViewer';
import { ProjectDocument, ChatMessage } from '../types';

describe('ProjectViewer Subcollection Lazy Loading', () => {
  const sampleProject: ProjectDocument = {
    id: 'pr-7k4x9q',
    title: 'Scriptorium Sample Project',
    description: 'Document under supervision',
    status: 'draft',
    tags: ['test', 'mvp'],
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
  };

  const sampleMessages: ChatMessage[] = [
    {
      id: 'ms-a1b2c3',
      sender: 'user',
      content: 'Can you shortlist three translators?',
      timestamp: '2026-10-16T10:00:00.000Z',
    },
    {
      id: 'ms-d4e5f6',
      sender: 'agent',
      content: 'I found three top candidates for your project.',
      timestamp: '2026-10-16T10:01:00.000Z',
    },
  ];

  it('projectViewer_rawJsonExpanderClicked_loadsAndDisplaysSubcollection_test', async () => {
    const mockLoader = vi.fn().mockImplementation(async (subcollectionName: string) => {
      expect(subcollectionName).toBe('messages');
      return sampleMessages;
    });

    const { unmount } = render(
      <ProjectViewer
        projectId="pr-7k4x9q"
        project={sampleProject}
        loading={false}
        onLoadSubcollection={mockLoader}
      />
    );

    try {
      // 1. Switch to Raw JSON view mode
      const rawToggle = screen.getByTestId('project-view-mode-raw');
      fireEvent.click(rawToggle);

      // 2. Verify subcollection is initially unexpanded and unloaded
      const toggleBtn = screen.getByTestId('subcollection-messages-toggle');
      expect(toggleBtn).toBeDefined();
      expect(toggleBtn.textContent).toContain('(click to load)');
      expect(mockLoader).not.toHaveBeenCalled();

      const collapsedPlaceholder = screen.getByTestId('subcollection-messages-collapsed');
      expect(collapsedPlaceholder.textContent).toContain('not loaded');

      // 3. Click expander to trigger lazy load
      fireEvent.click(toggleBtn);
      expect(mockLoader).toHaveBeenCalledTimes(1);

      // 4. Wait for subcollection items to render
      await waitFor(() => {
        const content = screen.getByTestId('subcollection-messages-content');
        expect(content).toBeDefined();
        expect(content.textContent).toContain('ms-a1b2c3');
        expect(content.textContent).toContain('Can you shortlist three translators?');
      });

      // 5. Verify document count badge updated
      expect(toggleBtn.textContent).toContain('(2 docs)');
      expect(toggleBtn.textContent).toContain('[click to collapse]');

      // 6. Verify reload button is present
      const reloadBtn = screen.getByTestId('reload-subcollection-messages-btn');
      expect(reloadBtn).toBeDefined();

      // 7. Click to collapse
      fireEvent.click(toggleBtn);
      expect(screen.queryByTestId('subcollection-messages-content')).toBeNull();
      expect(toggleBtn.textContent).toContain('[click to expand]');
      expect(screen.getByTestId('subcollection-messages-collapsed').textContent).toContain('2 documents (collapsed)');
    } finally {
      unmount();
    }
  });
});
