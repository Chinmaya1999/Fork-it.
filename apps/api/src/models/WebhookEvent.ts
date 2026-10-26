import { Schema, model } from 'mongoose';
const webhookSchema = new Schema({ eventId: { type: String, required: true, unique: true }, type: String, processedAt: { type: Date, default: Date.now } });
webhookSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // keep 30 days
export const WebhookEvent = model('WebhookEvent', webhookSchema);
