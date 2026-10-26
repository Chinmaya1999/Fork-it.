export interface PaymentInfo { id: string; orderId: string; status: 'captured' | 'authorized' | 'failed' | 'created' | 'refunded' | string; amountPaise: number }
export interface Gateway {
  name: 'razorpay' | 'mock';
  keyId?: string;
  createOrder(a: { amountPaise: number; receipt: string }): Promise<{ id: string }>;
  verifySignature(a: { orderId: string; paymentId: string; signature: string }): boolean;
  fetchPayment(paymentId: string): Promise<PaymentInfo | null>;
  /** Razorpay accounts with manual capture leave payments 'authorized'; the server captures them after checking amount + order. */
  capturePayment?(a: { paymentId: string; amountPaise: number }): Promise<void>;
  refund(a: { paymentId: string; amountPaise: number }): Promise<{ id: string }>;
}
