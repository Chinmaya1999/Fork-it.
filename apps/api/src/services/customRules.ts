import type { CustomStatus } from '@projectforge/shared';

/** Money: advance is rounded to whole paise, the remainder is the final payment, so advance + final === total always. */
export function splitPayments(totalPaise: number, advancePercent: number) {
  if (!Number.isInteger(totalPaise) || totalPaise < 1) throw new Error('total must be a positive integer (paise)');
  if (!(advancePercent >= 1 && advancePercent <= 100)) throw new Error('advance percent must be 1-100');
  const advancePaise = Math.round((totalPaise * advancePercent) / 100);
  return { advancePaise, finalPaise: totalPaise - advancePaise };
}

export type Actor = 'staff' | 'student' | 'system';
export type Action = 'start_review' | 'ask_clarification' | 'resume_review' | 'reject' | 'send_quotation' | 'accept_quotation' | 'decline_quotation' | 'advance_paid' | 'start_testing' | 'send_to_review' | 'back_to_dev' | 'approve_delivery' | 'request_revision' | 'request_final_payment' | 'final_paid' | 'complete' | 'cancel' | 'dispute' | 'resolve_dispute';

// action -> { who may do it, from-states, to-state }. Anything not listed is rejected by the backend.
const RULES: Record<Action, { actors: Actor[]; from: CustomStatus[]; to: CustomStatus | 'previous' }> = {
  start_review: { actors: ['staff'], from: ['submitted'], to: 'under_review' },
  ask_clarification: { actors: ['staff'], from: ['submitted', 'under_review', 'quoted'], to: 'clarification' },
  resume_review: { actors: ['staff', 'student'], from: ['clarification'], to: 'under_review' },
  reject: { actors: ['staff'], from: ['submitted', 'under_review', 'clarification'], to: 'rejected' },
  send_quotation: { actors: ['staff'], from: ['submitted', 'under_review', 'clarification', 'quoted'], to: 'quoted' },
  accept_quotation: { actors: ['student'], from: ['quoted'], to: 'awaiting_advance' },
  decline_quotation: { actors: ['student'], from: ['quoted'], to: 'under_review' },
  advance_paid: { actors: ['system'], from: ['awaiting_advance'], to: 'in_development' },
  start_testing: { actors: ['staff'], from: ['in_development'], to: 'internal_testing' },
  send_to_review: { actors: ['staff'], from: ['internal_testing', 'in_development'], to: 'student_review' },
  back_to_dev: { actors: ['staff'], from: ['internal_testing', 'revision_requested', 'student_review'], to: 'in_development' },
  approve_delivery: { actors: ['student'], from: ['student_review'], to: 'student_review' }, // sets studentApproved; status unchanged
  request_revision: { actors: ['student'], from: ['student_review'], to: 'revision_requested' },
  request_final_payment: { actors: ['staff'], from: ['student_review'], to: 'awaiting_final_payment' },
  final_paid: { actors: ['system'], from: ['awaiting_final_payment'], to: 'delivered' },
  complete: { actors: ['staff', 'student'], from: ['delivered'], to: 'completed' },
  cancel: { actors: ['staff', 'student'], from: ['submitted', 'under_review', 'clarification', 'quoted', 'awaiting_advance', 'in_development', 'internal_testing', 'student_review', 'revision_requested', 'awaiting_final_payment'], to: 'cancelled' },
  dispute: { actors: ['student'], from: ['in_development', 'internal_testing', 'student_review', 'revision_requested', 'awaiting_final_payment', 'delivered'], to: 'disputed' },
  resolve_dispute: { actors: ['staff'], from: ['disputed'], to: 'previous' },
};
export const TERMINAL: CustomStatus[] = ['rejected', 'cancelled', 'completed'];

/** Pure transition function — the single source of truth for what status changes are legal. Returns null when illegal. */
export function nextStatus(action: Action, from: CustomStatus, actor: Actor, previous?: string | null): CustomStatus | null {
  const r = RULES[action]; if (!r || !r.actors.includes(actor) || !r.from.includes(from)) return null;
  return r.to === 'previous' ? ((previous as CustomStatus | undefined) ?? 'in_development') : r.to;
}
