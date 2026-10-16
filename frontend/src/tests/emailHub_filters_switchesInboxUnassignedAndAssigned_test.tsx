import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailHub } from '../components/EmailHub';
import { ProjectEmail } from '../types';

describe('EmailHub Filter Categories', () => {
  const sampleEmails: ProjectEmail[] = [
    {
      id: 'em-000001',
      direction: 'inbound',
      from: 'candidate1@creative.com',
      to: ['info@seamcode.co.uk'],
      subject: 'Unassigned Email 1',
      body: 'Looking for work',
      timestamp: '2026-10-16T15:00:00Z',
    },
    {
      id: 'em-000002',
      direction: 'outbound',
      from: 'info@seamcode.co.uk',
      to: ['candidate2@creative.com'],
      subject: 'Assigned Outbound Email 2',
      body: 'Project brief details',
      timestamp: '2026-10-16T15:10:00Z',
      projectId: 'pr-111111',
    },
    {
      id: 'em-000003',
      direction: 'inbound',
      from: 'candidate3@creative.com',
      to: ['info@seamcode.co.uk'],
      subject: 'Assigned Inbound Email 3',
      body: 'Test submission',
      timestamp: '2026-10-16T15:20:00Z',
      projectId: 'pr-222222',
    },
  ];

  it('emailHubFilters_mixedEmails_rendersInboxUnassignedAssignedTabsAndFiltersCorrectly_test', async () => {
    const onAssignEmail = vi.fn().mockResolvedValue(undefined);
    const onSwitchToProject = vi.fn();

    const { unmount } = render(
      <EmailHub
        emails={sampleEmails}
        openProjectIds={[]}
        onAssignEmail={onAssignEmail}
        assigningId={null}
        onSwitchToProject={onSwitchToProject}
      />
    );

    try {
      const inboxBtn = screen.getByTestId('email-filter-inbox');
      const unassignedBtn = screen.getByTestId('email-filter-unassigned');
      const assignedBtn = screen.getByTestId('email-filter-assigned');

      // 1. Verify button labels and counts
      expect(inboxBtn.textContent).toBe('Inbox (3)');
      expect(unassignedBtn.textContent).toBe('Unassigned (1)');
      expect(assignedBtn.textContent).toBe('Assigned (2)');

      // 2. Default filter is 'unassigned' -> only em-000001 shown
      let cards = screen.getAllByTestId('email-hub-card');
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('Unassigned Email 1');

      // 3. Switch to 'inbox' (merged All) -> all 3 emails shown
      fireEvent.click(inboxBtn);
      cards = screen.getAllByTestId('email-hub-card');
      expect(cards.length).toBe(3);

      // 4. Switch to 'assigned' -> 2 emails shown
      fireEvent.click(assignedBtn);
      cards = screen.getAllByTestId('email-hub-card');
      expect(cards.length).toBe(2);
      expect(cards[0].textContent).toContain('Assigned Outbound Email 2');
      expect(cards[1].textContent).toContain('Assigned Inbound Email 3');
    } finally {
      unmount();
    }
  });
});
