import { Schema, model } from 'mongoose';
const paymentSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  gateway: { type: String, enum: ['razorpay', 'cashfree', 'mock'], required: true },
  gatewayOrderId: String,
  gatewayPaymentId: { type: String, unique: true, sparse: true },
  amountPaise: { type: Number, required: true },
  status: { type: String, enum: ['created', 'captured', 'failed'], default: 'created' },
  signatureVerified: { type: Boolean, default: false },
  source: { type: String, enum: ['client_verify', 'webhook', 'mock'], default: 'client_verify' },
  failureReason: String,
  capturedAt: Date,
}, { timestamps: true });
export const Payment = model('Payment', paymentSchema);
