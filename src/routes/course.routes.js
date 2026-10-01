import { Router } from "express";
import { getCourses, getCourseBySlugOrId } from "../controllers/course.controller.js";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware.js";

const router = Router();

router.get("/courses", getCourses);
router.get("/courses/:slugOrId", optionalAuthMiddleware, getCourseBySlugOrId);

export default router;
