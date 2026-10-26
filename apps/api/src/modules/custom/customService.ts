import { CustomRequest } from '../../models/CustomRequest.js';
import { Milestone } from '../../models/Milestone.js';
import { Quotation } from '../../models/Quotation.js';
import { nextSeq } from '../../models/Counter.js';
import { HttpError } from '../../utils/errors.js';
import { notify, notifyStaff } from '../../services/notify.js';
import { onOrderPaid, onOrderRefunded } from '../../services/payments.js';
import { nextStatus, type Action, type Actor } from '../../services/customRules.js';

const STUDENT_TEXT: Record<string, string> = {
  under_review: 'Your request is under review', clarification: 'We need a few clarifications on your request', quoted: 'A quotation is ready for your review', awaiting_advance: 'Quotation accepted — advance payment pending',
  in_development: 'Development has started', internal_testing: 'Your project is in internal testing', student_review: 'Your project is ready for your review', revision_requested: 'Revision requested', awaiting_final_payment: 'Final payment requested',
  delivered: 'Final delivery is available', completed: 'Project completed', rejected: 'Your request was declined', cancelled: 'Your request was cancelled', disputed: 'A dispute was opened on your project',
};
export const newRef = async () => `CR-${String(await nextSeq('custom')).padStart(6, '0')}`;

/** Atomic, validated status change. The status in the filter makes concurrent/stale transitions fail instead of overwriting each other. */
export async function transition(r: any, action: Action, actor: Actor, by: { id: string } | null, note?: string, extra: Record<string, unknown> = {}) {
  const to = nextStatus(action, r.status, actor, r.statusBeforeDispute);
  if (!to) throw new HttpError(409, `Cannot ${action.replace(/_/g, ' ')} while the request is "${r.status}"`, 'invalid_transition');
  const set: Record<string, unknown> = { status: to, ...extra };
  if (action === 'dispute') set.statusBeforeDispute = r.status;
  if (action === 'approve_delivery') set.studentApproved = true;
  if (action === 'back_to_dev' || action === 'request_revision') set.studentApproved = false;
  const updated = await CustomRequest.findOneAndUpdate({ _id: r._id, status: r.status }, { $set: set, $push: { history: { status: to, by: by?.id, role: actor, note, at: new Date() } } }, { new: true });
  if (!updated) throw new HttpError(409, 'The request was changed by someone else. Reload and try again.', 'conflict');
  const link = `/dashboard/custom/${updated._id}`;
  if (actor === 'student') await notifyStaffFor(updated, `${updated.ref}: ${STUDENT_TEXT[to] ?? to}`);
  else if (to !== r.status && STUDENT_TEXT[to]) await notify(String(updated.user), { type: 'custom_status', title: STUDENT_TEXT[to], body: `${updated.ref} · ${updated.title}`, link, dedupeKey: `cr:${updated._id}:${to}:${updated.history.length}`, email: ['quoted', 'in_development', 'student_review', 'awaiting_final_payment', 'delivered', 'rejected'].includes(to) });
  return updated;
}
export async function notifyStaffFor(r: any, title: string) {
  const n = { type: 'custom_activity', title, body: `${r.ref} · ${r.title}`, link: `/admin/custom/${r._id}` };
  if (r.assignedTo) await notify(String(r.assignedTo), n); else await notifyStaff(n);
}

// Payment hooks: only fired by services/payments.ts AFTER the gateway-verified, atomic paid transition.
onOrderPaid('custom_advance', async (o) => {
  const r = await CustomRequest.findById(o.customRequest); if (!r) return;
  const updated = await transition(r, 'advance_paid', 'system', null, `Advance ${o.ref} paid`).catch(() => null);
  if (!updated) return;
  if (!(await Milestone.exists({ request: r._id })) && r.agreed?.quotation) { // plan becomes live milestones, dated from the moment development starts
    const q = await Quotation.findById(r.agreed.quotation).lean();
    await Milestone.insertMany((q?.milestones ?? []).map((m, i) => ({ request: r._id, order: i, title: m.title, description: m.description, dueDate: new Date(Date.now() + (m.dueInDays ?? 0) * 864e5) })));
  }
  await notifyStaffFor(r, `${r.ref}: advance payment received — start development`);
});
onOrderPaid('custom_final', async (o) => {
  const r = await CustomRequest.findById(o.customRequest); if (r) await transition(r, 'final_paid', 'system', null, `Final payment ${o.ref} paid`).catch(() => null); // unlocks deliverables via entitlement()
});
onOrderRefunded('custom_advance', async (o) => { await CustomRequest.updateOne({ _id: o.customRequest, status: { $nin: ['completed', 'cancelled'] } }, { $set: { status: 'cancelled' }, $push: { history: { status: 'cancelled', role: 'system', note: 'Advance payment refunded', at: new Date() } } }); });
onOrderRefunded('custom_final', async (o) => { await CustomRequest.updateOne({ _id: o.customRequest, status: { $in: ['delivered', 'completed'] } }, { $set: { status: 'disputed', statusBeforeDispute: 'student_review' }, $push: { history: { status: 'disputed', role: 'system', note: 'Final payment refunded — deliverables locked', at: new Date() } } }); });
