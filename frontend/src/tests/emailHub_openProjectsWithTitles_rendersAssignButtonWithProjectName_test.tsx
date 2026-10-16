import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailHub } from '../components/EmailHub';
import { ProjectEmail } from '../types';

describe('EmailHub Component', () => {
  const sampleEmail: ProjectEmail = {
    id: 'em-1a2b3c',
    direction: 'inbound',
    from: 'candidate@creative.com',
    to: ['info@seamcode.co.uk'],
    subject: 'Transcreation Test Submission',
    body: 'Please find attached my test piece.',
    timestamp: '2026-10-16T15:00:00Z',
  };

  it('emailHub_openProjectsWithTitles_rendersAssignButtonWithProjectName_test', async () => {
    const onAssignEmail = vi.fn().mockResolvedValue(undefined);
    const onSwitchToProject = vi.fn();

    const { unmount } = render(
      <EmailHub
        emails={[sampleEmail]}
        openProjectIds={['pr-4g1o4w']}
        activeProjectId="pr-4g1o4w"
        onAssignEmail={onAssignEmail}
        assigningId={null}
        onSwitchToProject={onSwitchToProject}
        projectTitles={{ 'pr-4g1o4w': 'Infosys Campaign' }}
      />
    );

    try {
      // 1. Verify Quick Assign button exists
      const assignBtn = screen.getByTestId('emailhub-assign-btn');
      expect(assignBtn).toBeDefined();

      // 2. Button text must say "Assign to Infosys Campaign" without raw ID or "(active)"
      expect(assignBtn.textContent).toBe('Assign to Infosys Campaign');
      expect(assignBtn.textContent).not.toContain('pr-4g1o4w');
      expect(assignBtn.textContent).not.toContain('(active)');

      // 3. Verify data-project-id attribute
      expect(assignBtn.getAttribute('data-project-id')).toBe('pr-4g1o4w');

      // 4. Click assign button and verify callback
      fireEvent.click(assignBtn);
      expect(onAssignEmail).toHaveBeenCalledWith('em-1a2b3c', 'pr-4g1o4w');
    } finally {
      unmount();
    }
  });

  it('emailHub_openProjectsWithoutTitles_fallsBackToProjectIdInButton_test', async () => {
    const onAssignEmail = vi.fn().mockResolvedValue(undefined);
    const onSwitchToProject = vi.fn();

    const { unmount } = render(
      <EmailHub
        emails={[sampleEmail]}
        openProjectIds={['pr-4g1o4w']}
        activeProjectId="pr-4g1o4w"
        onAssignEmail={onAssignEmail}
        assigningId={null}
        onSwitchToProject={onSwitchToProject}
        projectTitles={{}}
      />
    );

    try {
      const assignBtn = screen.getByTestId('emailhub-assign-btn');
      expect(assignBtn).toBeDefined();

      // When title is absent, falls back to "Assign to pr-4g1o4w" without "(active)"
      expect(assignBtn.textContent).toBe('Assign to pr-4g1o4w');
      expect(assignBtn.textContent).not.toContain('(active)');
    } finally {
      unmount();
    }
  });
});
