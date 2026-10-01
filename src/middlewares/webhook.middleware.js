import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Validates incoming Paystack webhooks using HMAC-SHA512 signature comparison
 * Header: x-paystack-signature
 */
export const verifyPaystackSignature = (req, res, next) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Invalid Paystack signature' });
  }

  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return res.status(401).json({ error: 'Invalid Paystack signature' });
  }

  const payload = req.rawBody ? req.rawBody : JSON.stringify(req.body || {});
  const computedHash = crypto
    .createHmac('sha512', secret)
    .update(payload)
    .digest('hex');

  try {
    const hashBuffer = Buffer.from(computedHash, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');

    if (
      hashBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, signatureBuffer)
    ) {
      return res.status(401).json({ error: 'Invalid Paystack signature' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Paystack signature' });
  }

  next();
};

export default verifyPaystackSignature;
