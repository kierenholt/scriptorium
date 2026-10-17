import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectViewer } from '../components/ProjectViewer';
import { ProjectDocument, ShortlistedTalent } from '../types';

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

describe('ProjectViewer Shortlisted Talents Component Tests', () => {
  const mockProject: ProjectDocument = {
    id: 'pr-7k4x9q',
    title: 'Global Video Localisation',
    description: 'Subtitling and transcreation across EU languages',
    status: 'in_progress',
    tags: ['Transcreation', 'Subtitling'],
    artifacts: [],
    emails: [],
    createdAt: '2026-10-17T09:00:00Z',
    updatedAt: '2026-10-17T09:30:00Z',
  };

  const mockShortlist: ShortlistedTalent[] = [
    {
      id: 'sl-123456',
      talentId: 'tl-8m2k1a',
      name: 'Elena Rostova',
      role: 'Lead Transcreation Specialist',
      status: 'shortlisted',
      dayRate: '£450',
      notes: 'Fluent German and Russian, verified gaming experience.',
      createdAt: '2026-10-17T09:10:00Z',
      updatedAt: '2026-10-17T09:15:00Z',
    },
    {
      id: 'sl-654321',
      name: 'Jean-Luc Picard',
      role: 'French Voice Artist',
      status: 'booked',
      dayRate: '£600',
      notes: 'Available for studio recording Tuesday.',
      createdAt: '2026-10-17T09:20:00Z',
      updatedAt: '2026-10-17T09:25:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('projectViewer_shortlistedTalentsProvided_rendersRosterCardsWithStatuses_test', async () => {
    render(
      <ProjectViewer
        projectId="pr-7k4x9q"
        project={mockProject}
        loading={false}
        shortlistedTalents={mockShortlist}
      />
    );

    // 1. Check metric counter in Overview card
    const shortlistCounter = screen.getByTestId('project-shortlist-count');
    expect(shortlistCounter.textContent).toBe('2');

    // 2. Check sidebar nav item
    const navItem = screen.getByTestId('project-nav-shortlist');
    expect(navItem).toBeDefined();
    expect(navItem.textContent).toContain('Shortlisted Talent');
    expect(navItem.textContent).toContain('2');

    // 3. Switch to Shortlist domain section
    fireEvent.click(navItem);

    // 4. Assert roster list rendered
    const rosterList = screen.getByTestId('project-shortlist-list');
    expect(rosterList).toBeDefined();

    // 5. Assert individual talent cards
    const talent1Card = screen.getByTestId('project-shortlist-item-sl-123456');
    expect(talent1Card).toBeDefined();
    expect(screen.getByTestId('project-shortlist-name-sl-123456').textContent).toBe('Elena Rostova');
    expect(screen.getByTestId('project-shortlist-role-sl-123456').textContent).toBe('Lead Transcreation Specialist');
    expect(screen.getByTestId('project-shortlist-status-sl-123456').textContent).toBe('shortlisted');
    expect(screen.getByTestId('project-shortlist-rate-sl-123456').textContent).toBe('£450');
    expect(screen.getByTestId('project-shortlist-notes-sl-123456').textContent).toContain('Fluent German and Russian');

    const talent2Card = screen.getByTestId('project-shortlist-item-sl-654321');
    expect(talent2Card).toBeDefined();
    expect(screen.getByTestId('project-shortlist-name-sl-654321').textContent).toBe('Jean-Luc Picard');
    expect(screen.getByTestId('project-shortlist-status-sl-654321').textContent).toBe('booked');
  });

  it('projectViewer_rawJsonMode_rendersShortlistedTalentsSubcollection_test', async () => {
    render(
      <ProjectViewer
        projectId="pr-7k4x9q"
        project={mockProject}
        loading={false}
        shortlistedTalents={mockShortlist}
      />
    );

    // Switch to Raw JSON view
    const rawJsonToggle = screen.getByTestId('project-view-mode-raw');
    fireEvent.click(rawJsonToggle);

    // Verify raw JSON pre element exists
    const rawJsonPre = screen.getByTestId('project-raw-json');
    expect(rawJsonPre).toBeDefined();
    expect(rawJsonPre.textContent).toContain('shortlistedTalents');

    // Expand shortlistedTalents subcollection
    const toggleBtn = screen.getByTestId('subcollection-shortlist-toggle');
    fireEvent.click(toggleBtn);

    // Verify subcollection content displays the candidate names
    await waitFor(() => {
      const content = screen.getByTestId('subcollection-shortlist-content');
      expect(content.textContent).toContain('Elena Rostova');
      expect(content.textContent).toContain('Jean-Luc Picard');
    });
  });
});
