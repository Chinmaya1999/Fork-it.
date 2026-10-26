import { Schema, model } from 'mongoose';
import { ORDER_STATUSES, ORDER_TYPES } from '@projectforge/shared';

const orderSchema = new Schema({
  ref: { type: String, required: true, unique: true },
  type: { type: String, enum: ORDER_TYPES, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  project: { type: Schema.Types.ObjectId, ref: 'Project' },
  customRequest: { type: Schema.Types.ObjectId, ref: 'CustomRequest' },
  title: { type: String, required: true },           // snapshot at purchase time
  amountPaise: { type: Number, required: true, min: 1, validate: Number.isInteger }, // server-calculated; never from the browser
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ORDER_STATUSES, default: 'created', index: true },
  gateway: { type: String, enum: ['razorpay', 'cashfree', 'mock'], required: true },
  gatewayOrderId: { type: String, index: true },
  gatewaySessionId: String, // Cashfree payment_session_id, kept so a retried checkout can reuse the order
  paidAt: Date,
  receiptNo: { type: String, unique: true, sparse: true },
  refundedPaise: { type: Number, default: 0 },
}, { timestamps: true });
// A user can only ever have ONE paid order per (project | custom-request stage): blocks double fulfilment at the DB level.
orderSchema.index({ user: 1, project: 1, customRequest: 1, type: 1 }, { unique: true, partialFilterExpression: { status: 'paid' } });
orderSchema.index({ createdAt: -1 });
export const Order = model('Order', orderSchema);
