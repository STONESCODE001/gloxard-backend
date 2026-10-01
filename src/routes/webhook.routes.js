import { Router } from 'express';
import { handlePaystackWebhook } from '../controllers/webhook.controller.js';
import { verifyPaystackSignature } from '../middlewares/webhook.middleware.js';

const router = Router();

router.post('/paystack', verifyPaystackSignature, handlePaystackWebhook);

export default router;
