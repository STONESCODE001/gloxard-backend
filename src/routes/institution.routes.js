import { Router } from "express";
import {
  submitApplication,
  trackApplication,
  getPlans,
} from "../controllers/institution.controller.js";
import { activateInstitution } from "../controllers/activation.controller.js";
import institutionAdminRouter from "./institutionAdmin.routes.js";
import { authGuard } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { institutionContext } from "../middlewares/institution.middleware.js";
import { partnerApplicationLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

// Public catalogue of institution plans
router.get("/plans", getPlans);

// Submit new partnership application (Rate limited)
router.post("/applications", partnerApplicationLimiter, submitApplication);

// Public status tracking by reference ID
router.get("/applications/:referenceId", trackApplication);

// Public workspace activation with single-use 7-day token
router.post("/activate", activateInstitution);

// Tenant-scoped Institution Admin Workspaces (/api/institutions/me/*)
router.use("/me", authGuard, roleGuard("institution_admin"), institutionContext, institutionAdminRouter);

export default router;

