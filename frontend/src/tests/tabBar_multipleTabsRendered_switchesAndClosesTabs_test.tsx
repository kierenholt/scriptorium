import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from '../components/TabBar';

describe('TabBar Component', () => {
  it('tabBar_multipleTabsRendered_switchesAndClosesTabs_test', () => {
    const onSelectTab = vi.fn();
    const onCloseTab = vi.fn();
    const onOpenNewTabModal = vi.fn();

    const { unmount } = render(
      <TabBar
        projectIds={['pr-7k4x9q', 'pr-9x2m4k']}
        activeTab="pr-7k4x9q"
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onOpenNewTabModal={onOpenNewTabModal}
        unassignedEmailCount={3}
        projectTitles={{ 'pr-7k4x9q': 'Core Pipeline', 'pr-9x2m4k': 'Localization Pilot' }}
      />
    );

    try {
      // 1. Verify Pinned Emails tab and badge
      const emailsTab = screen.getByTestId('tab-emails');
      expect(emailsTab).toBeDefined();

      const badge = screen.getByTestId('tab-emails-badge');
      expect(badge.textContent).toBe('3');

      // 2. Click Emails tab
      fireEvent.click(emailsTab);
      expect(onSelectTab).toHaveBeenCalledWith('emails');

      // 3. Verify Project Tabs are rendered with titles and WITHOUT project IDs
      const tab1 = screen.getByTestId('tab-project-pr-7k4x9q');
      expect(tab1.textContent).toContain('Core Pipeline');
      expect(tab1.textContent).not.toContain('pr-7k4x9q');

      const tab2 = screen.getByTestId('tab-project-pr-9x2m4k');
      expect(tab2.textContent).toContain('Localization Pilot');
      expect(tab2.textContent).not.toContain('pr-9x2m4k');

      // 4. Click second project tab
      fireEvent.click(tab2);
      expect(onSelectTab).toHaveBeenCalledWith('pr-9x2m4k');

      // 5. Click close button on second project tab
      const closeBtn = screen.getByTestId('tab-close-btn-pr-9x2m4k');
      fireEvent.click(closeBtn);
      expect(onCloseTab).toHaveBeenCalledWith('pr-9x2m4k');

      // 6. Click '+' button to open new tab modal
      const newBtn = screen.getByTestId('tab-new-project-btn');
      fireEvent.click(newBtn);
      expect(onOpenNewTabModal).toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
