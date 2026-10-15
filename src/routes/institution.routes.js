import { Router } from "express";
import {
  submitApplication,
  trackApplication,
  getPlans,
} from "../controllers/institution.controller.js";
import { partnerApplicationLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

// Public catalogue of institution plans
router.get("/plans", getPlans);

// Submit new partnership application (Rate limited)
router.post("/applications", partnerApplicationLimiter, submitApplication);

// Public status tracking by reference ID
router.get("/applications/:referenceId", trackApplication);

export default router;
