import mongoose from 'mongoose';
import { Conversation, Message } from '../../models/Conversation.js';
import { CustomRequest } from '../../models/CustomRequest.js';
import { User } from '../../models/User.js';
import { forbidden, notFound } from '../../utils/errors.js';
import { notify, notifyStaff } from '../../services/notify.js';
import { emitToRoom, emitToStaff, emitToUser, isUserOnline } from '../../services/realtime.js';

export interface Actor { id: string; role: string; name: string }
export const isStaff = (a: Actor) => a.role === 'admin' || a.role === 'support';

/** Single authorization point for REST and sockets. Client-supplied ids are never trusted. */
export async function loadConversation(a: Actor, id: string) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Conversation not found');
  const c = await Conversation.findById(id); if (!c) throw notFound('Conversation not found');
  if (!isStaff(a) && String(c.user) !== a.id) throw forbidden('You are not part of this conversation');
  return c;
}
export const ensureGeneral = (userId: string) => Conversation.findOneAndUpdate({ user: userId, kind: 'general', customRequest: null }, { $setOnInsert: { user: userId, kind: 'general', title: 'ProjectForge team' } }, { upsert: true, new: true });
export async function ensureCustom(userId: string, requestId: string) {
  const r = await CustomRequest.findOne({ _id: requestId, user: userId }).select('ref title'); if (!r) throw notFound('Request not found');
  return Conversation.findOneAndUpdate({ user: userId, kind: 'custom', customRequest: r._id }, { $setOnInsert: { user: userId, kind: 'custom', customRequest: r._id, title: `${r.ref} · ${r.title}` } }, { upsert: true, new: true });
}

export async function sendMessage(a: Actor, conversationId: string, rawBody: string) {
  const body = String(rawBody ?? '').trim(); if (!body || body.length > 2000) throw Object.assign(new Error('Message must be 1-2000 characters'), { status: 400 });
  const c = await loadConversation(a, conversationId); const fromStaff = isStaff(a);
  const m = await Message.create({ conversation: c._id, sender: a.id, senderRole: fromStaff ? 'staff' : 'student', body });
  await Conversation.updateOne({ _id: c._id }, { $set: { lastMessageAt: m.createdAt, lastMessagePreview: body.slice(0, 120) }, $inc: fromStaff ? { unreadForUser: 1 } : { unreadForStaff: 1 } });
  const payload = { id: String(m._id), conversationId: String(c._id), senderRole: m.senderRole, senderName: a.name, body, createdAt: m.createdAt };
  emitToRoom(`conv:${c._id}`, 'message:new', payload); emitToUser(String(c.user), 'inbox:update', { conversationId: String(c._id) }); emitToStaff('inbox:update', { conversationId: String(c._id) });
  // Offline fallback: one rolling unread notification per conversation (no spam), plus an email to a student who isn't online.
  if (fromStaff) { const online = await isUserOnline(String(c.user)); await notify(String(c.user), { type: 'new_message', title: 'New message from the team', body: body.slice(0, 140), link: `/dashboard/messages/${c._id}`, dedupeKey: `msg:${c._id}:${c.lastReadByUser?.getTime() ?? 0}`, email: !online && (c.unreadForUser ?? 0) === 0 }); }
  else { const stu = await User.findById(a.id).select('name').lean(); await notifyStaff({ type: 'new_message', title: `New message from ${stu?.name ?? 'a student'}`, body: body.slice(0, 140), link: `/admin/messages/${c._id}`, dedupeKey: `smsg:${c._id}:${c.lastReadByStaff?.getTime() ?? 0}` }); }
  return payload;
}

export async function markRead(a: Actor, conversationId: string) {
  const c = await loadConversation(a, conversationId); const staff = isStaff(a);
  await Conversation.updateOne({ _id: c._id }, staff ? { unreadForStaff: 0, lastReadByStaff: new Date() } : { unreadForUser: 0, lastReadByUser: new Date() });
  emitToRoom(`conv:${c._id}`, 'conversation:read', { conversationId: String(c._id), by: staff ? 'staff' : 'student', at: new Date() });
  if (!staff) { const { Notification } = await import('../../models/Notification.js'); await Notification.updateMany({ user: a.id, type: 'new_message', link: `/dashboard/messages/${c._id}`, readAt: null }, { readAt: new Date() }); }
  return { ok: true };
}
