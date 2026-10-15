import { Router } from "express";
import { authGuard } from "../middlewares/auth.middleware.js";
import { cohortGuard } from "../middlewares/cohort.middleware.js";
import {
  getLmsMe,
  getStudentDashboard,
} from "../controllers/lmsDashboard.controller.js";
import {
  getCohortCurriculum,
  getLessonDetail,
  updateLessonProgress,
  getComments,
  createComment,
  replyComment,
  likeComment,
  unlikeComment,
} from "../controllers/lmsCurriculum.controller.js";
import {
  getQuizOverview,
  startQuizAttempt,
  answerQuestion,
  submitQuizAttempt,
} from "../controllers/lmsQuiz.controller.js";
import {
  listAssignments,
  getAssignment,
  submitAssignment,
  getGradingQueue,
  gradeSubmission,
} from "../controllers/lmsAssignment.controller.js";

const router = Router();

// 1. Context & Unified Dashboard
router.get("/me", authGuard, getLmsMe);
router.get("/dashboard/student", authGuard, cohortGuard, getStudentDashboard);

// 2. Curriculum & Lesson Player
router.get("/cohorts/:cohortId/curriculum", authGuard, cohortGuard, getCohortCurriculum);
router.get("/lessons/:lessonId", authGuard, cohortGuard, getLessonDetail);
router.put("/lessons/:lessonId/progress", authGuard, cohortGuard, updateLessonProgress);

// 3. Threaded Lesson Discussions & Likes
router.get("/lessons/:lessonId/comments", authGuard, cohortGuard, getComments);
router.post("/lessons/:lessonId/comments", authGuard, cohortGuard, createComment);
router.post("/comments/:id/replies", authGuard, cohortGuard, replyComment);
router.post("/comments/:id/like", authGuard, cohortGuard, likeComment);
router.delete("/comments/:id/like", authGuard, cohortGuard, unlikeComment);

// 4. Quizzes Engine & Server Timing
router.get("/quizzes/:quizId", authGuard, cohortGuard, getQuizOverview);
router.post("/quizzes/:quizId/attempts", authGuard, cohortGuard, startQuizAttempt);
router.post("/quiz-attempts/:attemptId/answers", authGuard, cohortGuard, answerQuestion);
router.post("/quiz-attempts/:attemptId/submit", authGuard, cohortGuard, submitQuizAttempt);

// 5. Assignments & Grading Queue
router.get("/assignments", authGuard, cohortGuard, listAssignments);
router.get("/assignments/:id", authGuard, cohortGuard, getAssignment);
router.post("/assignments/:id/submissions", authGuard, cohortGuard, submitAssignment);
router.get("/instructor/grading-queue", authGuard, cohortGuard, getGradingQueue);
router.put("/submissions/:id/grade", authGuard, cohortGuard, gradeSubmission);

export default router;
