import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';
import { config } from '../config';

// Mock Firebase service subscriptions so no real backend is required for unit tests
vi.mock('../services/firebase', () => ({
  subscribeToInboxEmails: vi.fn(() => () => {}),
  subscribeToAllEmails: vi.fn(() => () => {}),
  fetchRecentProjectsList: vi.fn().mockResolvedValue([]),
  listenToProjectDocument: vi.fn(() => () => {}),
  subscribeToProject: vi.fn(() => () => {}),
  subscribeToMessages: vi.fn(() => () => {}),
}));

vi.mock('../services/api', () => ({
  fetchInboxEmails: vi.fn().mockResolvedValue([]),
  assignEmailToProject: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Supervisor Token Guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('supervisorTokenGuard_missingToken_rendersAccessDenied_test', () => {
    window.history.replaceState(null, '', '/');
    const { unmount } = render(<App />);
    try {
      const accessDenied = screen.getByTestId('access-denied-screen');
      expect(accessDenied).toBeDefined();
      expect(screen.getByText(/403 — Access Denied/i)).toBeDefined();
      expect(screen.queryByTestId('header')).toBeNull();
      expect(screen.queryByTestId('tab-emails')).toBeNull();
    } finally {
      unmount();
    }
  });

  it('supervisorTokenGuard_invalidToken_rendersAccessDenied_test', () => {
    window.history.replaceState(null, '', '/?token=invalid_dummy_token_12345');

    const { unmount } = render(<App />);
    try {
      const accessDenied = screen.getByTestId('access-denied-screen');
      expect(accessDenied).toBeDefined();
      expect(screen.queryByTestId('header')).toBeNull();
      expect(screen.queryByTestId('tab-emails')).toBeNull();
    } finally {
      unmount();
    }
  });

  it('supervisorTokenGuard_validToken_authenticatesAndPersists_test', () => {
    window.history.replaceState(null, '', `/?token=${config.supervisorToken}&tab=emails`);

    const { unmount } = render(<App />);
    try {
      // Access denied screen should NOT be visible
      expect(screen.queryByTestId('access-denied-screen')).toBeNull();

      // Console UI components should be mounted
      expect(screen.getByTestId('header')).toBeDefined();
      expect(screen.getByTestId('tab-emails')).toBeDefined();

      // Token should be persisted in sessionStorage
      expect(sessionStorage.getItem('scriptorium_supervisor_token')).toBe(config.supervisorToken);

      // Token should be removed from the URL
      expect(window.location.search).not.toContain('token=');
    } finally {
      unmount();
    }
  });

  it('supervisorTokenGuard_standaloneProjectParam_bypassesTokenGuardAndRendersProjectView_test', () => {
    window.history.replaceState(null, '', '/?project=pr-7k4x9q');

    const { unmount } = render(<App />);
    try {
      // Access denied screen should NOT be visible even with no supervisor token
      expect(screen.queryByTestId('access-denied-screen')).toBeNull();

      // Standalone project view should be mounted
      expect(screen.getByTestId('standalone-project-view-pr-7k4x9q')).toBeDefined();
    } finally {
      unmount();
    }
  });
});
