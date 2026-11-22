/**
 * BidarCRM - TanStack Query Key Factory
 *
 * Provides strongly-typed, hierarchical cache invalidation keys for all
 * Front-Office CRM data domains.
 */

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },
  deals: {
    all: ['deals'] as const,
    lists: () => [...queryKeys.deals.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.deals.lists(), filters] as const,
    details: () => [...queryKeys.deals.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.deals.details(), id] as const,
    kanban: (pipelineId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.deals.all, 'kanban', pipelineId, filters] as const,
    stream: (id: string) => [...queryKeys.deals.detail(id), 'stream'] as const,
  },
  pipelines: {
    all: ['pipelines'] as const,
    list: () => [...queryKeys.pipelines.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.pipelines.all, 'detail', id] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    lists: () => [...queryKeys.contacts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.contacts.lists(), filters] as const,
    details: () => [...queryKeys.contacts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    lists: () => [...queryKeys.accounts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.accounts.lists(), filters] as const,
    details: () => [...queryKeys.accounts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.accounts.details(), id] as const,
  },
  activities: {
    all: ['activities'] as const,
    lists: () => [...queryKeys.activities.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.activities.lists(), filters] as const,
    calendar: (from?: string, to?: string) =>
      [...queryKeys.activities.all, 'calendar', from, to] as const,
    detail: (type: 'Call' | 'Meeting' | 'Task', id: string) =>
      [...queryKeys.activities.all, type, id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: (pipelineId?: string, from?: string, to?: string) =>
      [...queryKeys.dashboard.all, 'summary', pipelineId, from, to] as const,
  },
  search: {
    global: (query: string) => ['search', 'global', query] as const,
  },
} as const;

export default queryKeys;
