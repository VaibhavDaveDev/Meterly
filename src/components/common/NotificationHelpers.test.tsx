import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { timeAgo, NotificationIcon, iconColorClass, formatNotificationTime } from './NotificationHelpers';

describe('NotificationHelpers timeAgo', () => {
  it('returns empty string if timestamp is null', () => {
    expect(timeAgo(null)).toBe('');
  });

  it('returns just now for recent events', () => {
    const ts = new Date(Date.now() - 30 * 1000).toISOString(); // 30s ago
    expect(timeAgo(ts)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const ts = new Date(Date.now() - 300 * 1000).toISOString(); // 5m ago
    expect(timeAgo(ts)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const ts = new Date(Date.now() - 7200 * 1000).toISOString(); // 2h ago
    expect(timeAgo(ts)).toBe('2h ago');
  });

  it('returns Yesterday', () => {
    const ts = new Date(Date.now() - 90000 * 1000).toISOString(); // 25h ago
    expect(timeAgo(ts)).toBe('Yesterday');
  });

  it('returns days ago', () => {
    const ts = new Date(Date.now() - 200000 * 1000).toISOString(); // ~2.3d ago
    expect(timeAgo(ts)).toBe('2d ago');
  });
});

describe('NotificationHelpers formatNotificationTime', () => {
  it('returns empty string if timestamp is null', () => {
    expect(formatNotificationTime(null)).toBe('');
  });

  it('formats timestamp correctly', () => {
    // Jan 15, 2026 at 2:30 PM (UTC-ish or timezone independent local time)
    const date = new Date('2026-01-15T14:30:00');
    const ts = date.toISOString();
    expect(formatNotificationTime(ts)).toBe('Jan 15, 2026 at 2:30 PM');
  });
});

describe('NotificationHelpers NotificationIcon', () => {
  it('renders default bell icon for unknown type', () => {
    const { container } = render(<NotificationIcon type="unknown_type" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders dollar sign icon for bill_ready', () => {
    const { container } = render(<NotificationIcon type="bill_ready" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders check icon for reading_approved', () => {
    const { container } = render(<NotificationIcon type="reading_approved" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders clock icon for payment_reminder', () => {
    const { container } = render(<NotificationIcon type="payment_reminder" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders users icon for tenant_accepted', () => {
    const { container } = render(<NotificationIcon type="tenant_accepted" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders activity icon for readings_submitted', () => {
    const { container } = render(<NotificationIcon type="readings_submitted" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders x icon for reading_rejected', () => {
    const { container } = render(<NotificationIcon type="reading_rejected" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders file-edit icon for edit_request_raised', () => {
    const { container } = render(<NotificationIcon type="edit_request_raised" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders zap icon for rate_changed', () => {
    const { container } = render(<NotificationIcon type="rate_changed" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('NotificationHelpers iconColorClass', () => {
  it('returns correct color class for bill_ready', () => {
    expect(iconColorClass('bill_ready')).toContain('text-emerald-600');
  });

  it('returns correct color class for payment_reminder', () => {
    expect(iconColorClass('payment_reminder')).toContain('text-amber-600');
  });

  it('returns correct color class for tenant_accepted', () => {
    expect(iconColorClass('tenant_accepted')).toContain('text-blue-600');
  });

  it('returns correct color class for reading_approved', () => {
    expect(iconColorClass('reading_approved')).toContain('text-emerald-600');
  });

  it('returns correct color class for reading_rejected', () => {
    expect(iconColorClass('reading_rejected')).toContain('text-red-600');
  });

  it('returns correct color class for rate_changed', () => {
    expect(iconColorClass('rate_changed')).toContain('text-violet-600');
  });

  it('returns default color class for unknown type', () => {
    expect(iconColorClass('unknown')).toBe('text-muted-foreground bg-muted');
  });
});
