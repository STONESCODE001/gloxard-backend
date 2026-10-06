import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware.js';
import { roleGuard } from '../middlewares/role.middleware.js';
import {
  getDashboardStatsController,
  getRecentRegistrationsController,
  getRecentTransactionsController,
  getUsersController,
  deactivateUserController,
  moderateTutorApprovalController,
  getPendingCoursesController,
  getAllCoursesController,
  moderateCourseStatusController,
  getAppealsController,
  moderateAppealStatusController,
  getFinanceMetricsController,
  broadcastNotificationController,
  getUserDetailsController,
  getAdminCourseDetailsController,
  getPlatformSettingsController,
  updatePlatformSettingsController,
  getAdminReviewsController,
  deleteAdminReviewController,
} from '../controllers/admin.controller.js';

const router = Router();

// Apply authGuard and roleGuard('admin') to all admin endpoints
router.use(authGuard, roleGuard('admin'));

router.get('/dashboard-stats', getDashboardStatsController);
router.get('/recent-registrations', getRecentRegistrationsController);
router.get('/recent-transactions', getRecentTransactionsController);

router.get('/users', getUsersController);
router.get('/users/:id', getUserDetailsController);
router.delete('/users/:id', deactivateUserController);
router.put('/tutors/:id/approval', moderateTutorApprovalController);

router.get('/courses/pending', getPendingCoursesController);
router.get('/courses/all', getAllCoursesController);
router.get('/courses/:id', getAdminCourseDetailsController);
router.put('/courses/:id/status', moderateCourseStatusController);

router.get('/appeals', getAppealsController);
router.put('/appeals/:id/status', moderateAppealStatusController);

router.get('/finance', getFinanceMetricsController);
router.post('/broadcast', broadcastNotificationController);

router.get('/settings', getPlatformSettingsController);
router.put('/settings', updatePlatformSettingsController);

router.get('/reviews', getAdminReviewsController);
router.delete('/reviews/:id', deleteAdminReviewController);

export default router;
