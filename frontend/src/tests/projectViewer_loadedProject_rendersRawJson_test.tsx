import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectViewer } from '../components/ProjectViewer';
import { ProjectDocument } from '../types';

describe('ProjectViewer', () => {
  const sampleProject: ProjectDocument = {
    id: 'pr-7k4x9q',
    title: 'Scriptorium Sample Project',
    description: 'Document under supervision',
    status: 'draft',
    tags: ['test', 'mvp'],
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
  };

  it('projectViewer_loadedProject_rendersStructuredInspector_test', () => {
    const { unmount } = render(
      <ProjectViewer project={sampleProject} loading={false} />
    );

    try {
      // 1. Verify Structured Inspector elements render by default
      const titleElement = screen.getByTestId('project-title-heading');
      expect(titleElement.textContent).toContain('Scriptorium Sample Project');

      const statusBadge = screen.getByTestId('project-status-badge');
      expect(statusBadge.textContent).toContain('draft');

      const briefContent = screen.getByTestId('project-brief-content');
      expect(briefContent.textContent).toContain('Document under supervision');

      // 2. Verify navigation items
      expect(screen.getByTestId('project-nav-overview')).toBeDefined();
      expect(screen.getByTestId('project-nav-brief')).toBeDefined();
      expect(screen.getByTestId('project-nav-tags')).toBeDefined();
      expect(screen.getByTestId('project-nav-artifacts')).toBeDefined();
      expect(screen.getByTestId('project-nav-emails')).toBeDefined();

      // 3. Verify tags list
      expect(screen.getByTestId('project-tag-test')).toBeDefined();
      expect(screen.getByTestId('project-tag-mvp')).toBeDefined();
    } finally {
      unmount();
    }
  });

  it('projectViewer_loadedProject_rendersRawJson_test', () => {
    const { unmount } = render(
      <ProjectViewer project={sampleProject} loading={false} />
    );

    try {
      // Switch to Raw JSON view mode
      const rawToggle = screen.getByTestId('project-view-mode-raw');
      fireEvent.click(rawToggle);

      const codeElement = screen.getByTestId('project-raw-json');
      expect(codeElement).toBeDefined();
      expect(codeElement.textContent).toContain('Scriptorium Sample Project');
      expect(codeElement.textContent).toContain('"status": "draft"');
    } finally {
      unmount();
    }
  });
});
