import { Schema, model } from 'mongoose';
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = model('Counter', counterSchema);
/** Atomic, gap-tolerant sequence generator (order refs, receipts, tickets). */
export const nextSeq = async (name: string) => (await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { upsert: true, new: true })).seq;
