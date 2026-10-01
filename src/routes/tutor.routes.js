import { Router } from "express";
import {
  showcaseExpertiseController,
  getDashboardStatsController,
  getEarningsController,
} from "../controllers/tutor.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = Router();

// Apply authMiddleware to all tutor onboarding and analytics endpoints
router.use(authMiddleware);

// POST /api/tutor/showcase-expertise (Student or Instructor)
router.post("/showcase-expertise", showcaseExpertiseController);

// GET /api/tutor/dashboard-stats (Instructor only)
router.get("/dashboard-stats", roleMiddleware("instructor"), getDashboardStatsController);

// GET /api/tutor/earnings (Instructor only)
router.get("/earnings", roleMiddleware("instructor"), getEarningsController);

export default router;
