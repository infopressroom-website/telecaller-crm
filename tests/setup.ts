/**
 * Vitest setup file
 * Runs before each test suite
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables (non-readonly assignment)
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  AUTH_SECRET: 'test-secret-at-least-32-characters-long',
});

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => ({
    get: vi.fn(),
  }),
}));

// Global test utilities
global.testUtils = {
  mockUser: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    roleKey: 'ADMIN' as const,
    role: {
      id: 'test-role-id',
      key: 'ADMIN',
      name: 'Administrator',
    },
    teamId: null,
    team: null,
  },
  mockLead: {
    id: 'test-lead-id',
    leadCode: 'LD-000001',
    name: 'Test Lead',
    primaryMobile: '919876543210',
    status: 'NEW' as const,
    priority: 'MEDIUM' as const,
    ownerId: null,
    teamId: null,
    sourceId: null,
    campaignId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

declare global {
  var testUtils: {
    mockUser: any;
    mockLead: any;
  };
}
