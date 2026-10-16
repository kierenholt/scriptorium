import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectViewer } from '../components/ProjectViewer';
import { ProjectDocument } from '../types';

describe('ProjectViewer', () => {
  it('projectViewer_loadedProject_rendersRawJson_test', () => {
    // Test setup with test data
    const sampleProject: ProjectDocument = {
      id: 'project-default',
      title: 'Scriptorium Sample Project',
      description: 'Document under supervision',
      status: 'draft',
      tags: ['test', 'mvp'],
      createdAt: '2026-10-16T00:00:00.000Z',
      updatedAt: '2026-10-16T00:00:00.000Z',
    };

    const { unmount } = render(
      <ProjectViewer project={sampleProject} loading={false} />
    );

    try {
      const codeElement = screen.getByTestId('project-raw-json');
      expect(codeElement).toBeDefined();
      expect(codeElement.textContent).toContain('Scriptorium Sample Project');
      expect(codeElement.textContent).toContain('"status": "draft"');
    } finally {
      // Clean up after test
      unmount();
    }
  });
});
