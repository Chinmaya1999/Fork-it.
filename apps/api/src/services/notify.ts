import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { emitToUser } from './realtime.js';
import { sendMail } from '../utils/mailer.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface NotifyInput { type: string; title: string; body?: string; link?: string; dedupeKey?: string; email?: boolean }

/** Persistent in-app notification (+ realtime push, + optional email). A repeated dedupeKey never notifies twice. */
export async function notify(userId: string, n: NotifyInput) {
  try {
    const doc = n.dedupeKey
      ? await Notification.findOneAndUpdate({ user: userId, dedupeKey: n.dedupeKey }, { $setOnInsert: { user: userId, type: n.type, title: n.title, body: n.body ?? '', link: n.link, dedupeKey: n.dedupeKey } }, { upsert: true, new: true, rawResult: true })
      : { value: await Notification.create({ user: userId, type: n.type, title: n.title, body: n.body ?? '', link: n.link }), lastErrorObject: { updatedExisting: false } };
    const fresh = !(doc as any).lastErrorObject?.updatedExisting;
    if (!fresh) return;
    emitToUser(userId, 'notification:new', { id: String((doc as any).value._id), title: n.title, body: n.body, link: n.link });
    if (n.email) { const u = await User.findById(userId).select('email').lean(); if (u) await sendMail(u.email, n.title, `${n.body ?? ''}\n\n${n.link ? env.CLIENT_URL + n.link : ''}`.trim()); }
  } catch (err) { logger.error({ err }, 'notify failed'); } // notifications must never break the business action
}

export async function notifyStaff(n: NotifyInput) {
  const staff = await User.find({ role: { $in: ['admin', 'support'] }, status: 'active' }).select('_id').lean();
  await Promise.all(staff.map((u) => notify(String(u._id), n.dedupeKey ? { ...n, dedupeKey: n.dedupeKey } : n)));
}
