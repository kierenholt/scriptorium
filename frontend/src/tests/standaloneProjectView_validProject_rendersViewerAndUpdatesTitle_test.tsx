import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StandaloneProjectView } from '../components/StandaloneProjectView';
import { ProjectViewer } from '../components/ProjectViewer';
import * as firebaseService from '../services/firebase';

vi.mock('../services/firebase', () => ({
  subscribeToProject: vi.fn(),
  subscribeToMessages: vi.fn(),
  fetchProjectMessages: vi.fn().mockResolvedValue([]),
  subscribeToShortlistedTalents: vi.fn(() => () => {}),
  fetchProjectShortlistedTalents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/api', () => ({
  seedProject: vi.fn().mockResolvedValue(undefined),
}));

describe('StandaloneProjectView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = 'Default Title';
  });

  it('standaloneProjectView_validProjectId_rendersProjectViewerAndUpdatesTitle_test', async () => {
    // Mock Firestore returning project document
    (firebaseService.subscribeToProject as any).mockImplementation((projectId: string, onUpdate: any) => {
      onUpdate({
        id: projectId,
        title: 'Acme Localization Campaign',
        status: 'in_progress',
        description: 'Vetted localization test pool',
        tags: ['Copywriting', 'French', 'Subtitling'],
        artifacts: [],
        emails: [],
        createdAt: '2026-10-16T12:00:00Z',
        updatedAt: '2026-10-16T12:30:00Z',
      });
      return () => {};
    });

    (firebaseService.subscribeToMessages as any).mockImplementation(() => () => {});

    const { unmount } = render(<StandaloneProjectView projectId="pr-7k4x9q" />);

    try {
      // 1. Verify standalone container is rendered
      const container = screen.getByTestId('standalone-project-view-pr-7k4x9q');
      expect(container).toBeDefined();

      // 2. Verify sub-sidebar Project Domain navigation buttons are present
      expect(screen.getByTestId('project-nav-overview')).toBeDefined();
      expect(screen.getByTestId('project-nav-brief')).toBeDefined();
      expect(screen.getByTestId('project-nav-tags')).toBeDefined();
      expect(screen.getByTestId('project-nav-artifacts')).toBeDefined();
      expect(screen.getByTestId('project-nav-emails')).toBeDefined();

      // 3. Verify project title heading in Inspector
      const titleHeading = screen.getByTestId('project-title-heading');
      expect(titleHeading.textContent).toBe('Acme Localization Campaign');

      // 4. Verify document.title was dynamically set
      await waitFor(() => {
        expect(document.title).toBe('Acme Localization Campaign | Scriptorium');
      });

      // 5. Verify project-only-link is omitted when already in standalone view
      expect(screen.queryByTestId('project-only-link')).toBeNull();
    } finally {
      unmount();
    }
  });

  it('projectViewer_supervisorDashboardMode_rendersProjectOnlyLink_test', () => {
    const mockProject = {
      id: 'pr-7k4x9q',
      title: 'Acme Localization Campaign',
      status: 'in_progress' as const,
      description: 'Test project',
      tags: [],
      artifacts: [],
      emails: [],
      createdAt: '2026-10-16T12:00:00Z',
      updatedAt: '2026-10-16T12:30:00Z',
    };

    const { unmount } = render(
      <ProjectViewer projectId="pr-7k4x9q" project={mockProject} loading={false} isStandalone={false} />
    );

    try {
      const link = screen.getByTestId('project-only-link') as HTMLAnchorElement;
      expect(link).toBeDefined();
      expect(link.getAttribute('href')).toBe('/?project=pr-7k4x9q');
      expect(link.getAttribute('target')).toBe('_blank');
    } finally {
      unmount();
    }
  });

  it('standaloneProjectView_invalidProjectId_rendersErrorState_test', () => {
    const { unmount } = render(<StandaloneProjectView projectId="invalid-id" />);

    try {
      // 1. Verify invalid state card is rendered
      const invalidCard = screen.getByTestId('standalone-project-invalid');
      expect(invalidCard).toBeDefined();
      expect(invalidCard.textContent).toContain('Project Not Found or Invalid ID');
      expect(invalidCard.textContent).toContain('invalid-id');

      // 2. Verify input and return button exist
      expect(screen.getByTestId('standalone-project-input')).toBeDefined();
      expect(screen.getByTestId('standalone-return-supervisor-btn')).toBeDefined();

      // 3. Verify document.title updated to error title
      expect(document.title).toBe('Project Not Found | Scriptorium');
    } finally {
      unmount();
    }
  });
});
