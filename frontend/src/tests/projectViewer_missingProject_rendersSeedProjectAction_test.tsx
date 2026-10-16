import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectViewer } from '../components/ProjectViewer';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  seedProject: vi.fn().mockResolvedValue(undefined),
}));

describe('ProjectViewer Empty State', () => {
  it('projectViewer_missingProject_rendersSeedProjectAction_test', async () => {
    const { unmount } = render(
      <ProjectViewer projectId="pr-7k4x9q" project={null} loading={false} />
    );

    try {
      // 1. Verify empty state container is rendered
      const emptyContainer = screen.getByTestId('project-viewer-empty');
      expect(emptyContainer).toBeDefined();
      expect(emptyContainer.textContent).toContain('No Firestore record found for pr-7k4x9q');

      // 2. Verify seed button is rendered
      const seedBtn = screen.getByTestId('seed-project-btn');
      expect(seedBtn).toBeDefined();
      expect(seedBtn.textContent).toContain('Initialize / Seed Project');

      // 3. Click seed button and verify seedProject was called
      fireEvent.click(seedBtn);

      await waitFor(() => {
        expect(api.seedProject).toHaveBeenCalledWith('pr-7k4x9q');
      });
    } finally {
      unmount();
    }
  });
});
