# Payments, downloads & webhooks

## How a payment is trusted
1. The browser asks `POST /api/v1/orders` (or `/custom-requests/:id/pay`). The **server** computes the amount from the database and creates the gateway order. Any amount sent by the browser is ignored.
2. The browser opens the gateway checkout. When it returns, it calls `POST /orders/:id/verify` with the payment id + signature.
3. The server checks the HMAC signature, asks the **gateway** for the payment (status must be `captured`, order id and amount must match), and only then performs one atomic `created|failed → paid` transition. Side effects (receipt, notifications, custom-project status) run exactly once, even with duplicate verifies or webhooks.
4. `POST /api/v1/webhooks/razorpay` does the same from Razorpay's server: raw-body HMAC check, duplicate event ids are ignored, mismatched payloads are acknowledged and ignored (a retry could never succeed).
5. Downloads: `POST /files/:id/link` re-checks that the user has a **paid, non-refunded** order (or a delivered custom project whose final payment is verified), then returns a 5-minute signed link bound to that user. The link is re-checked on use, so a refund revokes access immediately. Every download is audited and limited (`DOWNLOAD_LIMIT`).

## Sandbox gateway (development only)
With no Razorpay keys, `NODE_ENV != production` **and** a localhost `CLIENT_URL`, a clearly-labelled sandbox gateway is used. It signs and verifies payments with the same code path, but no real money moves. In production, with no keys, payments are simply unavailable (HTTP 503).

## Going live with Razorpay (pending external configuration)
1. Create a Razorpay account, generate **test** keys, put them in `.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. In the Razorpay dashboard add a webhook to `https://YOUR-DOMAIN/api/v1/webhooks/razorpay` for `payment.captured`, `order.paid`, `payment.failed`; set the secret as `RAZORPAY_WEBHOOK_SECRET`.
3. Run a real test-mode purchase end to end, then a refund from Admin → Orders.
4. Only then switch to live keys. The Razorpay adapter has **not** been exercised against the live Razorpay API in this repository (no keys were available) — the signature/capture/refund logic is covered by tests against the sandbox gateway.

## Storage
Files live in `STORAGE_DIR` (local disk, random keys, never exposed). Uploads are limited by type + magic bytes; **antivirus scanning is not configured**. The production target is a private S3 bucket with presigned URLs (pending).

## Reconciliation & refunds
Admin → Orders: refunds go through the gateway (full refund revokes access). "Reconcile" accepts a gateway payment id but only marks the order paid if the gateway confirms capture and the amount — admins cannot mark an order paid by hand.

## Edge cases handled
- **Manual-capture accounts:** a payment left `authorized` is captured by the server only after order id + amount match, then re-read from the gateway.
- **Price changed while the checkout window was open:** the old order is cancelled, but if the customer pays it anyway and the gateway proves the exact amount, the order is fulfilled (never keep money without delivering).
- **Refunds** reserve the amount atomically before calling the gateway, so double-clicks / two admins cannot refund twice; a gateway failure releases the reservation.
- **Duplicate payment for an item already owned:** staff are notified to refund it from the gateway dashboard.
- Payment routes have their own rate limit (60 / 10 min / IP).
