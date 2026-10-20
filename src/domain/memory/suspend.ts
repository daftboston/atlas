import type { KnowledgeItemStatus } from '@/domain/types';

export type SuspendState = {
  status: KnowledgeItemStatus;
  statusBeforeSuspend: KnowledgeItemStatus | null;
};

/**
 * learning-loop §9. Suspending remembers the exact status, including mastered.
 * Suspending an item that is already suspended changes nothing.
 */
export function suspendItem(state: SuspendState): SuspendState {
  if (state.status === 'suspended') return state;
  return { status: 'suspended', statusBeforeSuspend: state.status };
}

/** Restores the status saved at suspend time. A suspended item with nothing saved stays suspended. */
export function unsuspendItem(state: SuspendState): SuspendState {
  if (state.status !== 'suspended') return state;
  if (state.statusBeforeSuspend === null || state.statusBeforeSuspend === 'suspended') return state;
  return { status: state.statusBeforeSuspend, statusBeforeSuspend: null };
}
