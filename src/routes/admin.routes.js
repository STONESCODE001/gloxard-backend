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
  broadcastNotificationController
} from '../controllers/admin.controller.js';

const router = Router();

// Apply authGuard and roleGuard('admin') to all admin endpoints
router.use(authGuard, roleGuard('admin'));

router.get('/dashboard-stats', getDashboardStatsController);
router.get('/recent-registrations', getRecentRegistrationsController);
router.get('/recent-transactions', getRecentTransactionsController);

router.get('/users', getUsersController);
router.delete('/users/:id', deactivateUserController);
router.put('/tutors/:id/approval', moderateTutorApprovalController);

router.get('/courses/pending', getPendingCoursesController);
router.get('/courses/all', getAllCoursesController);
router.put('/courses/:id/status', moderateCourseStatusController);

router.get('/appeals', getAppealsController);
router.put('/appeals/:id/status', moderateAppealStatusController);

router.get('/finance', getFinanceMetricsController);
router.post('/broadcast', broadcastNotificationController);

export default router;
