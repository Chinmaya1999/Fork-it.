import { Schema, model } from 'mongoose';
const refundSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
  amountPaise: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['processed', 'failed'], default: 'processed' },
  gatewayRefundId: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export const Refund = model('Refund', refundSchema);
