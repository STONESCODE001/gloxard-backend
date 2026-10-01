import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware.js';
import {
  enrollFreeCourse,
  checkoutPaidCourse,
  getMyCourses,
  checkEnrollmentStatus,
} from '../controllers/enrollment.controller.js';

const router = Router();

// All enrollment routes require user authentication
router.use(authGuard);

router.post('/enroll/:courseId', enrollFreeCourse);
router.post('/checkout', checkoutPaidCourse);
router.get('/my-courses', getMyCourses);
router.get('/check/:courseId', checkEnrollmentStatus);

export default router;
