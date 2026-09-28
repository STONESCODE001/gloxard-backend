import { Router } from "express";
import { getPresignedUrl, mockUpload } from "../controllers/upload.controller.js";
import { authGuard } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/presigned-url", authGuard, getPresignedUrl);
router.put("/mock-put/*path", mockUpload);

export default router;
