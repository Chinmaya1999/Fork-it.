export interface PaymentInfo { id: string; orderId: string; status: 'captured' | 'authorized' | 'failed' | 'created' | 'refunded' | string; amountPaise: number }
export interface Gateway {
  name: 'razorpay' | 'cashfree' | 'mock';
  keyId?: string;
  /** Cashfree environment, passed to the browser SDK. */
  mode?: 'production' | 'sandbox';
  createOrder(a: { amountPaise: number; receipt: string; customer?: { id: string; name?: string; email?: string; phone?: string }; returnUrl?: string }): Promise<{ id: string; sessionId?: string }>;
  /** Gateways whose browser callback is signed (Razorpay, sandbox). Absent = the server finds the payment itself via listPayments. */
  verifySignature?(a: { orderId: string; paymentId: string; signature: string }): boolean;
  /** `orderId` is the gateway order id, for gateways that look payments up per order. */
  fetchPayment(paymentId: string, orderId?: string): Promise<PaymentInfo | null>;
  listPayments?(gatewayOrderId: string): Promise<PaymentInfo[]>;
  /** Razorpay accounts with manual capture leave payments 'authorized'; the server captures them after checking amount + order. */
  capturePayment?(a: { paymentId: string; amountPaise: number }): Promise<void>;
  refund(a: { paymentId: string; amountPaise: number; orderId?: string }): Promise<{ id: string }>;
}
