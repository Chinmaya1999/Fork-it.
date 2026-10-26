import { Ticket, TicketReply } from '../../models/Ticket.js';
import { nextSeq } from '../../models/Counter.js';
import { notify, notifyStaff } from '../../services/notify.js';

export const addSystemNote = (ticketId: unknown, body: string) => TicketReply.create({ ticket: ticketId, authorRole: 'system', kind: 'system', body });
export const newTicketNumber = async () => `TK-${String(await nextSeq('ticket')).padStart(6, '0')}`;

/** Who should hear about a student's activity: the assignee if there is one, otherwise all staff. */
export async function notifyStaffAbout(t: { _id: unknown; assignedTo?: unknown; number: string; subject: string }, title: string) {
  const link = `/admin/tickets/${t._id}`;
  if (t.assignedTo) await notify(String(t.assignedTo), { type: 'ticket_activity', title, body: `${t.number} · ${t.subject}`, link });
  else await notifyStaff({ type: 'ticket_activity', title, body: `${t.number} · ${t.subject}`, link });
}
export { Ticket, TicketReply };
