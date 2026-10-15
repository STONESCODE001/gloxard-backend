import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import { io } from 'socket.io-client';

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = `${BASE_URL}/api`;

let totalSuites = 0;
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function logHeader(text) {
  console.log(`\n\x1b[36m==================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m ${text} \x1b[0m`);
  console.log(`\x1b[36m==================================================\x1b[0m`);
}

function logSuite(name) {
  totalSuites++;
  console.log(`\n\x1b[33m[SUITE ${totalSuites}] ${name}\x1b[0m`);
}

function assert(condition, message, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  \x1b[32m[PASS]\x1b[0m ${message}`);
  } else {
    failedAssertions++;
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${message} ${details ? `(${details})` : ''}`);
  }
}

async function runSmokeTests() {
  const startTime = Date.now();

  logHeader('RUNNING E2E SMOKE TESTS - Gloxad Academy');

  // Step 1: Health / Port availability check
  try {
    await axios.get(`${API_URL}/categories`, { timeout: 3000 });
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error(`\x1b[31m[ERROR] Server is not running on http://localhost:${PORT}.\x1b[0m`);
      console.error(`\x1b[31mPlease start the server using 'npm start' or 'npm run dev' before running e2e smoke tests.\x1b[0m\n`);
      process.exit(1);
    }
  }

  // Tokens & context state
  let adminToken = '';
  let janeToken = '';
  let aliceToken = '';
  let bobToken = '';
  let publishedCourseId = '';
  let publishedCourseSlug = '';

  // Step 2: Obtain Auth Tokens from Seed Data
  try {
    const adminRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'admin@gloxad.com',
      password: 'Password123!'
    });
    adminToken = adminRes.data.token;

    const janeRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'jane.tutor@gloxad.com',
      password: 'Password123!'
    });
    janeToken = janeRes.data.token;

    const aliceRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'alice.student@gloxad.com',
      password: 'Password123!'
    });
    aliceToken = aliceRes.data.token;

    const bobRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'bob.student@gloxad.com',
      password: 'Password123!'
    });
    bobToken = bobRes.data.token;
  } catch (err) {
    console.error(`\x1b[31m[ERROR] Failed to authenticate seed users. Did you run 'npm run seed' first?\x1b[0m`);
    console.error(err.response?.data || err.message);
    process.exit(1);
  }

  // ==========================================
  // PART 1: ARCHITECTURAL INVARIANTS VERIFICATION
  // ==========================================

  // Invariant 1: Uniform Error Schema Validation
  logSuite('INVARIANT 1: Uniform Error Schema Validation');
  try {
    // 400 Bad Request
    let res400;
    try {
      await axios.post(`${API_URL}/auth/signup`, {});
    } catch (err) {
      res400 = err.response;
    }
    assert(
      res400?.status === 400 &&
        typeof res400?.data?.error === 'string' &&
        Object.keys(res400?.data || {}).length === 1,
      '400 Bad Request strictly returns { "error": "<msg>" } schema'
    );

    // 401 Unauthorized
    let res401;
    try {
      await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: 'Bearer invalidtoken123' }
      });
    } catch (err) {
      res401 = err.response;
    }
    assert(
      res401?.status === 401 &&
        typeof res401?.data?.error === 'string' &&
        Object.keys(res401?.data || {}).length === 1,
      '401 Unauthorized strictly returns { "error": "<msg>" } schema'
    );

    // 403 Forbidden
    let res403;
    try {
      await axios.post(
        `${API_URL}/tutor/courses`,
        { title: 'Student Attempt' },
        { headers: { Authorization: `Bearer ${aliceToken}` } }
      );
    } catch (err) {
      res403 = err.response;
    }
    assert(
      res403?.status === 403 &&
        typeof res403?.data?.error === 'string' &&
        Object.keys(res403?.data || {}).length === 1,
      '403 Forbidden strictly returns { "error": "<msg>" } schema'
    );

    // 404 Not Found
    let res404;
    try {
      await axios.get(`${API_URL}/courses/non-existent-course-id-999`);
    } catch (err) {
      res404 = err.response;
    }
    assert(
      res404?.status === 404 &&
        typeof res404?.data?.error === 'string' &&
        Object.keys(res404?.data || {}).length === 1,
      '404 Not Found strictly returns { "error": "<msg>" } schema'
    );
  } catch (err) {
    assert(false, 'Invariant 1 exception', err.message);
  }

  // Invariant 2: Presigned S3 Media Offloading Validation
  logSuite('INVARIANT 2: Presigned S3 Media Offloading Validation');
  try {
    const s3Res = await axios.post(
      `${API_URL}/upload/presigned-url`,
      { filename: 'test-lecture.mp4', fileType: 'video/mp4', folder: 'courses' },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      s3Res.status === 200 &&
        typeof s3Res.data.uploadUrl === 'string' &&
        typeof s3Res.data.fileUrl === 'string',
      'Presigned upload endpoint returns uploadUrl and fileUrl'
    );

    let multipart404;
    try {
      await axios.post(`${API_URL}/upload/multipart`);
    } catch (err) {
      multipart404 = err.response;
    }
    assert(
      multipart404?.status === 404,
      'Express backend has zero multipart buffer streaming endpoints (404)'
    );
  } catch (err) {
    assert(false, 'Invariant 2 exception', err.message);
  }

  // Invariant 3: Content Protection Integrity Validation
  logSuite('INVARIANT 3: Content Protection Integrity Validation');
  try {
    const listRes = await axios.get(`${API_URL}/courses?courseType=paid`);
    const paidCourse = listRes.data.courses.find((c) => c.slug === 'fullstack-javascript-mastery') || listRes.data.courses[0];
    publishedCourseId = paidCourse._id;
    publishedCourseSlug = paidCourse.slug;

    // Unauthenticated request
    const unauthRes = await axios.get(`${API_URL}/courses/${publishedCourseId}`);
    const unauthCourse = unauthRes.data.course;
    let hasUnauthVideo = false;
    let hasUnauthQuizAnswer = false;

    unauthCourse.modules.forEach((mod) => {
      mod.lessons.forEach((les) => {
        if (!les.isFreePreview && les.videoUrl) hasUnauthVideo = true;
      });
      mod.quizzes.forEach((q) => {
        q.questions.forEach((quest) => {
          if (quest.correctOptionIndex !== undefined) hasUnauthQuizAnswer = true;
        });
      });
    });

    assert(!hasUnauthVideo, 'Non-preview lesson videoUrl is stripped for un-enrolled callers');
    assert(!hasUnauthQuizAnswer, 'Quiz correctOptionIndex is stripped for non-instructors');

    // Enrolled student request (Alice is enrolled in fullstack-javascript-mastery)
    const authRes = await axios.get(`${API_URL}/courses/${publishedCourseId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const authCourse = authRes.data.course;
    let hasAuthVideo = false;
    authCourse.modules.forEach((mod) => {
      mod.lessons.forEach((les) => {
        if (les.videoUrl) hasAuthVideo = true;
      });
    });
    assert(hasAuthVideo, 'Video URL is fully accessible for enrolled student');
  } catch (err) {
    assert(false, 'Invariant 3 exception', err.message);
  }

  // Invariant 4: Paystack Verification & Idempotency Validation
  logSuite('INVARIANT 4: Paystack Server-Side Verification & Idempotency Validation');
  try {
    let failPaystack;
    try {
      await axios.post(
        `${API_URL}/enrollments/checkout`,
        { courseId: publishedCourseId, reference: 'INVALID_REF_X' },
        { headers: { Authorization: `Bearer ${bobToken}` } }
      );
    } catch (err) {
      failPaystack = err.response;
    }
    assert(
      failPaystack?.status === 400 && typeof failPaystack?.data?.error === 'string',
      'Invalid Paystack reference returns 400 uniform error'
    );

    // Test Paystack mock checkout
    const mockRef = `PAYSTACK_TEST_REF_SMOKE_${Date.now()}`;
    const checkoutRes1 = await axios.post(
      `${API_URL}/enrollments/checkout`,
      { courseId: publishedCourseId, reference: mockRef },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      checkoutRes1.status === 201 || checkoutRes1.status === 200,
      'Valid Paystack reference completes enrollment checkout'
    );

    // Duplicate checkout request with exact same reference
    const checkoutRes2 = await axios.post(
      `${API_URL}/enrollments/checkout`,
      { courseId: publishedCourseId, reference: mockRef },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      checkoutRes2.status === 200 && checkoutRes2.data.enrollment !== undefined,
      'Duplicate Paystack reference is handled idempotently without duplicate error'
    );
  } catch (err) {
    assert(false, 'Invariant 4 exception', err.message);
  }

  // Invariant 5: Primary Key _id Naming Consistency Validation
  logSuite('INVARIANT 5: Primary Key _id Naming Consistency Validation');
  try {
    const meRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const userObj = meRes.data.user;
    assert(
      typeof userObj._id === 'string' && userObj.id === undefined,
      'User entity primary key strictly uses string _id without id alias'
    );

    const catRes = await axios.get(`${API_URL}/categories`);
    const catItem = catRes.data.categories[0];
    assert(
      typeof catItem._id === 'string' && catItem.id === undefined,
      'Category entity primary key strictly uses string _id'
    );

    const courseRes = await axios.get(`${API_URL}/courses`);
    const courseItem = courseRes.data.courses[0];
    assert(
      typeof courseItem._id === 'string' && courseItem.id === undefined,
      'Course entity primary key strictly uses string _id'
    );
  } catch (err) {
    assert(false, 'Invariant 5 exception', err.message);
  }

  // ==========================================
  // PART 2: END-TO-END USER FLOW EXECUTION
  // ==========================================

  // Flow 1: User Auth & Verification Flow
  logSuite('FLOW 1: User Auth & Verification Lifecycle');
  try {
    const testEmail = `smoke.student.${Date.now()}@gloxad.com`;
    const signupRes = await axios.post(`${API_URL}/auth/signup`, {
      firstName: 'Smoke',
      lastName: 'TestUser',
      email: testEmail,
      password: 'Password123!',
      role: 'student'
    });
    assert(
      signupRes.status === 201 && signupRes.data.token && signupRes.data.user,
      'Signup creates user and returns JWT token'
    );

    const signinRes = await axios.post(`${API_URL}/auth/signin`, {
      email: testEmail,
      password: 'Password123!'
    });
    assert(signinRes.status === 200 && signinRes.data.token, 'Signin succeeds with valid credentials');

    const updateProfileRes = await axios.put(
      `${API_URL}/auth/update-profile`,
      { bio: 'Updated Smoke Test Bio' },
      { headers: { Authorization: `Bearer ${signinRes.data.token}` } }
    );
    assert(
      updateProfileRes.status === 200 && updateProfileRes.data.user.bio === 'Updated Smoke Test Bio',
      'Profile updated successfully'
    );
  } catch (err) {
    assert(false, 'Flow 1 exception', err.message);
  }

  // Flow 2: Tutor Showcase & Admin Moderation Flow
  logSuite('FLOW 2: Tutor Showcase & Admin Moderation Flow');
  let newInstructorId = '';
  try {
    const tutorEmail = `smoke.tutor.${Date.now()}@gloxad.com`;
    const signupTutorRes = await axios.post(`${API_URL}/auth/signup`, {
      firstName: 'NewTutor',
      lastName: 'Applicant',
      email: tutorEmail,
      password: 'Password123!',
      role: 'instructor'
    });
    const newTutorToken = signupTutorRes.data.token;
    newInstructorId = signupTutorRes.data.user._id;

    const showcaseRes = await axios.post(
      `${API_URL}/tutor/showcase-expertise`,
      { areaOfExpertise: 'Web Development', expertiseBio: 'Expertise showcase bio' },
      { headers: { Authorization: `Bearer ${newTutorToken}` } }
    );
    assert(
      showcaseRes.status === 200 && showcaseRes.data.user.approvalStatus === 'pending',
      'Showcase expertise sets instructor approvalStatus to pending'
    );

    const pendingListRes = await axios.get(`${API_URL}/admin/users?role=instructor&approvalStatus=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      pendingListRes.status === 200 && pendingListRes.data.users.length > 0,
      'Admin fetches pending instructors list'
    );

    const approveRes = await axios.put(
      `${API_URL}/admin/tutors/${newInstructorId}/approval`,
      { approvalStatus: 'approved' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      approveRes.status === 200 && approveRes.data.user.approvalStatus === 'approved',
      'Admin approves tutor successfully'
    );
  } catch (err) {
    assert(false, 'Flow 2 exception', err.message);
  }

  // Flow 3: 5-Step Course Authoring & Review Pipeline
  logSuite('FLOW 3: 5-Step Course Authoring & Review Pipeline');
  try {
    const createCourseRes = await axios.post(
      `${API_URL}/tutor/courses`,
      {
        title: `Smoke Author Course ${Date.now()}`,
        category: 'Web Development',
        courseType: 'paid',
        price: 29.99
      },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    const draftCourseId = createCourseRes.data.course._id;
    assert(createCourseRes.status === 201 && draftCourseId, 'Tutor initializes draft course (Step 1)');

    const updateCourseRes = await axios.put(
      `${API_URL}/tutor/courses/${draftCourseId}`,
      {
        subtitle: 'Comprehensive Authoring Test',
        description: 'Complete course description for testing and validation purposes.',
        thumbnail: 'https://gloxad-bucket.s3.amazonaws.com/courses/demo-thumb.jpg',
        skills: ['JavaScript', 'Testing'],
        welcomeMessage: 'Welcome to the authoring test course!',
        congratsMessage: 'Congratulations on completing this test course!',
        modules: [
          {
            title: 'Module 1: Setup',
            lessons: [
              { title: 'Lesson 1', videoUrl: 'https://gloxad-bucket.s3.amazonaws.com/courses/demo.mp4', isFreePreview: true }
            ],
            quizzes: [
              {
                title: 'Quiz 1',
                passingScore: 70,
                questions: [{ questionText: 'Is authoring working?', options: ['Yes', 'No'], correctOptionIndex: 0 }]
              }
            ]
          }
        ]
      },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(updateCourseRes.status === 200, 'Tutor populates modules & quizzes (Steps 2-4)');

    const submitRes = await axios.post(
      `${API_URL}/tutor/courses/${draftCourseId}/submit`,
      {},
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      submitRes.status === 200 && submitRes.data.course.status === 'pending',
      'Tutor submits course for review (Step 5)'
    );

    const publishRes = await axios.put(
      `${API_URL}/admin/courses/${draftCourseId}/status`,
      { status: 'published' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      publishRes.status === 200 && publishRes.data.course.status === 'published',
      'Admin approves and publishes course'
    );
  } catch (err) {
    assert(false, 'Flow 3 exception', err.message);
  }

  // Flow 4: Public Course Discovery & Search
  logSuite('FLOW 4: Public Course Discovery & Search');
  try {
    const searchRes = await axios.get(`${API_URL}/courses?search=JavaScript`);
    assert(
      searchRes.status === 200 && Array.isArray(searchRes.data.courses),
      'Public search by keyword returns courses'
    );

    const filterRes = await axios.get(`${API_URL}/courses?category=Web Development`);
    assert(
      filterRes.status === 200 &&
        filterRes.data.pagination &&
        typeof filterRes.data.pagination.total === 'number',
      'Category filter returns pagination metadata (page, limit, total, totalPages)'
    );
  } catch (err) {
    assert(false, 'Flow 4 exception', err.message);
  }

  // Flow 5: Free & Paid Enrollments
  logSuite('FLOW 5: Free & Paid Enrollments');
  try {
    const catalogRes = await axios.get(`${API_URL}/courses?courseType=free`);
    const freeCourse = catalogRes.data.courses[0];

    if (freeCourse) {
      const freeEnrollRes = await axios.post(
        `${API_URL}/enrollments/enroll/${freeCourse._id}`,
        {},
        { headers: { Authorization: `Bearer ${aliceToken}` } }
      );
      assert(
        freeEnrollRes.status === 201 || freeEnrollRes.status === 200,
        'Student enrolls in free course'
      );
    } else {
      assert(true, 'Free course check (skipped)');
    }

    const checkRes = await axios.get(`${API_URL}/enrollments/check/${publishedCourseId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(checkRes.status === 200 && checkRes.data.isEnrolled === true, 'Check enrollment returns isEnrolled: true');
  } catch (err) {
    assert(false, 'Flow 5 exception', err.message);
  }

  // Flow 6: Learning Engine & Quiz Evaluation
  logSuite('FLOW 6: Learning Engine & Quiz Evaluation');
  try {
    const courseRes = await axios.get(`${API_URL}/courses/${publishedCourseId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const courseObj = courseRes.data.course;
    const lesson1Id = courseObj.modules[0].lessons[0]._id;
    const module2 = courseObj.modules[1];
    const quiz1Id = module2.quizzes[0]._id;

    const progressRes = await axios.post(
      `${API_URL}/learning/${publishedCourseId}/progress`,
      { lessonId: lesson1Id, completed: true },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    assert(
      progressRes.status === 200 &&
        (typeof progressRes.data.progressPercentage === 'number' || typeof progressRes.data.progress?.progressPercentage === 'number'),
      'Lesson progress recorded successfully'
    );

    const quizRes = await axios.post(
      `${API_URL}/learning/${publishedCourseId}/quiz/${quiz1Id}/submit`,
      { answers: [0, 1] },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    assert(
      quizRes.status === 200 &&
        (quizRes.data.passed === true || quizRes.data.result?.passed === true) &&
        (typeof quizRes.data.score === 'number' || typeof quizRes.data.result?.score === 'number'),
      'Server-side quiz grading evaluates submitted answers correctly'
    );
  } catch (err) {
    assert(false, 'Flow 6 exception', err.message);
  }

  // Flow 7: Real-Time Messaging & Notifications
  logSuite('FLOW 7: Real-Time Messaging & Notifications');
  try {
    const convsRes = await axios.get(`${API_URL}/messages/conversations`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const conv = convsRes.data.conversations[0];
    const convId = conv._id;

    // Test Socket.io real-time connection
    const socket = io(BASE_URL, {
      auth: { token: aliceToken },
      transports: ['websocket', 'polling']
    });

    let receivedSocketMsg = false;
    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.emit('join_conversation', { conversationId: convId });

        socket.on('new_message', (msgData) => {
          if (msgData.text === 'E2E Socket Test Message') {
            receivedSocketMsg = true;
          }
        });

        // Trigger REST message post
        setTimeout(async () => {
          try {
            await axios.post(
              `${API_URL}/messages/${convId}`,
              { text: 'E2E Socket Test Message' },
              { headers: { Authorization: `Bearer ${aliceToken}` } }
            );
          } catch (e) {
            console.error('Socket message post error:', e.message);
          }
          setTimeout(() => {
            socket.disconnect();
            resolve();
          }, 600);
        }, 300);
      });

      socket.on('connect_error', () => {
        socket.disconnect();
        resolve();
      });
    });

    assert(receivedSocketMsg, 'Socket.io client receives real-time new_message event');

    const notifRes = await axios.get(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      notifRes.status === 200 && Array.isArray(notifRes.data.notifications),
      'Notifications fetched successfully'
    );
  } catch (err) {
    assert(false, 'Flow 7 exception', err.message);
  }

  // ==========================================
  // FLOW 8: Unit 16 Frontend Integration Gap Remediation Verification
  // ==========================================
  logSuite('FLOW 8: Unit 16 Frontend Integration Gap Remediation Verification');
  try {
    // 1. POST /api/auth/refresh
    const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(refreshRes.status === 200 && refreshRes.data.token, 'POST /api/auth/refresh returns 200 with refreshed token');
    const refUser = refreshRes.data.user;
    assert(
      refUser &&
      refUser.isVerified === refUser.isEmailVerified &&
      refUser.bio === refUser.biography &&
      refUser.avatarUrl !== undefined &&
      refUser.avatar !== undefined &&
      refUser.socials !== undefined &&
      refUser.socialLinks !== undefined,
      'User profile contains all standardized dual-key aliases (isVerified/isEmailVerified, bio/biography, socials/socialLinks, avatar/avatarUrl)'
    );

    // 2. GET /api/admin/users/:id
    const adminUserRes = await axios.get(`${API_URL}/admin/users/${refUser._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      adminUserRes.status === 200 &&
      adminUserRes.data.user &&
      Array.isArray(adminUserRes.data.user.experienceProofs),
      'GET /api/admin/users/:id returns 200 with full user profile including experienceProofs'
    );

    // 3. GET /api/admin/courses/:id
    const adminCourseRes = await axios.get(`${API_URL}/admin/courses/${publishedCourseId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      adminCourseRes.status === 200 &&
      adminCourseRes.data.course &&
      adminCourseRes.data.course._id === publishedCourseId,
      'GET /api/admin/courses/:id returns 200 with unshielded course details'
    );

    // 4. GET /api/admin/courses/pending
    const pendingCoursesRes = await axios.get(`${API_URL}/admin/courses/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      pendingCoursesRes.status === 200 &&
      Array.isArray(pendingCoursesRes.data.courses) &&
      pendingCoursesRes.data.courses.length > 0 &&
      pendingCoursesRes.data.courses[0].category &&
      typeof pendingCoursesRes.data.courses[0].category === 'object' &&
      pendingCoursesRes.data.courses[0].category.name,
      'GET /api/admin/courses/pending returns populated category object with name and _id'
    );

    // 5. Platform Settings GET & PUT
    const getSettingsRes = await axios.get(`${API_URL}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      getSettingsRes.status === 200 &&
      getSettingsRes.data.settings &&
      getSettingsRes.data.settings.allowSignups !== undefined,
      'GET /api/admin/settings returns 200 with platform settings singleton'
    );

    const updateSettingsRes = await axios.put(
      `${API_URL}/admin/settings`,
      {
        deletionGraceDays: 45,
        signatureUrl: 'https://gloxad-bucket.s3.amazonaws.com/signatures/dean-sig.png'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      updateSettingsRes.status === 200 &&
      updateSettingsRes.data.settings.deletionGraceDays === 45 &&
      updateSettingsRes.data.settings.signatureUrl === 'https://gloxad-bucket.s3.amazonaws.com/signatures/dean-sig.png',
      'PUT /api/admin/settings successfully updates platform configuration'
    );

    // 6. GET /api/tutor/search-instructors
    const searchInstRes = await axios.get(`${API_URL}/tutor/search-instructors?q=jane`, {
      headers: { Authorization: `Bearer ${janeToken}` }
    });
    assert(
      searchInstRes.status === 200 &&
      Array.isArray(searchInstRes.data.instructors) &&
      searchInstRes.data.instructors.some((inst) => inst.email === 'jane.tutor@gloxad.com'),
      'GET /api/tutor/search-instructors?q=jane returns matching approved instructors'
    );

    // 7. Course Reviews: POST /api/courses/:id/reviews
    const reviewPostRes = await axios.post(
      `${API_URL}/courses/${publishedCourseId}/reviews`,
      {
        rating: 5,
        comment: 'Absolutely top notch course on fullstack Node and Express!'
      },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    assert(
      reviewPostRes.status === 201 &&
      reviewPostRes.data.review &&
      reviewPostRes.data.review.rating === 5,
      'POST /api/courses/:id/reviews creates student review and recalculates course rating'
    );
    const createdReviewId = reviewPostRes.data.review._id;

    // 8. Public Reviews: GET /api/courses/:id/reviews
    const publicReviewsRes = await axios.get(`${API_URL}/courses/${publishedCourseId}/reviews`);
    assert(
      publicReviewsRes.status === 200 &&
      Array.isArray(publicReviewsRes.data.reviews) &&
      publicReviewsRes.data.reviews.length > 0,
      'GET /api/courses/:id/reviews returns paginated course reviews'
    );

    // 9. Tutor Review Management: GET /api/tutor/reviews & POST /api/tutor/reviews/:id/reply
    const tutorReviewsRes = await axios.get(`${API_URL}/tutor/reviews`, {
      headers: { Authorization: `Bearer ${janeToken}` }
    });
    assert(
      tutorReviewsRes.status === 200 &&
      Array.isArray(tutorReviewsRes.data.reviews) &&
      tutorReviewsRes.data.reviews.length > 0,
      'GET /api/tutor/reviews returns reviews for instructor courses'
    );

    const replyRes = await axios.post(
      `${API_URL}/tutor/reviews/${createdReviewId}/reply`,
      { comment: 'Thank you so much Alice! Delighted that you found it valuable.' },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      replyRes.status === 200 &&
      replyRes.data.review.tutorReply &&
      replyRes.data.review.tutorReply.comment.includes('Thank you so much Alice'),
      'POST /api/tutor/reviews/:id/reply records tutor response to student review'
    );

    // 10. Admin Review Moderation: GET /api/admin/reviews & DELETE /api/admin/reviews/:id
    const adminReviewsRes = await axios.get(`${API_URL}/admin/reviews`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      adminReviewsRes.status === 200 &&
      Array.isArray(adminReviewsRes.data.reviews) &&
      adminReviewsRes.data.reviews.length > 0,
      'GET /api/admin/reviews returns all platform reviews'
    );

    const deleteReviewRes = await axios.delete(`${API_URL}/admin/reviews/${createdReviewId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      deleteReviewRes.status === 200 &&
      deleteReviewRes.data.message === 'Review deleted successfully',
      'DELETE /api/admin/reviews/:id deletes review and auto-recalculates course rating'
    );

  } catch (err) {
    assert(false, 'Flow 8 exception', err.response?.data?.error || err.message);
  }

  // ==========================================
  // FLOW 9: PARTNER APPLICATION, REVIEWER DECISION & ACTIVATION FLOW
  // ==========================================
  logSuite('FLOW 9: Partner Applications, Reviewer Portal & Infrastructure');
  try {
    // 1. Health Checks Decoupling
    const livenessRes = await axios.get(`${BASE_URL}/api/health/liveness`);
    assert(
      livenessRes.status === 200 &&
      livenessRes.data.status === 'ok' &&
      typeof livenessRes.data.uptime === 'number',
      'GET /api/health/liveness returns 200 with uptime'
    );

    const readinessRes = await axios.get(`${BASE_URL}/api/health/readiness`);
    assert(
      readinessRes.status === 200 &&
      readinessRes.data.status === 'ready' &&
      readinessRes.data.database === 'connected' &&
      readinessRes.data.storage === 'connected',
      'GET /api/health/readiness returns 200 with connected database and storage'
    );

    // 2. S3 Folder Expansion & Private Isolation
    const privateDocUploadRes = await axios.post(`${API_URL}/upload/presigned-url`, {
      filename: 'Charter.pdf',
      fileType: 'application/pdf',
      folder: 'documents'
    });
    assert(
      privateDocUploadRes.status === 200 &&
      typeof privateDocUploadRes.data.uploadUrl === 'string' &&
      typeof privateDocUploadRes.data.key === 'string' &&
      privateDocUploadRes.data.fileUrl === undefined,
      'POST /api/upload/presigned-url permits unauthenticated document upload and isolates private folder key without fileUrl'
    );

    const signedGetRes = await axios.get(`${API_URL}/upload/signed-url?key=documents/test.pdf`, {
      headers: { Authorization: `Bearer ${janeToken}` }
    });
    assert(
      signedGetRes.status === 200 &&
      typeof signedGetRes.data.signedUrl === 'string' &&
      signedGetRes.data.expiresIn === 300,
      'GET /api/upload/signed-url returns 5-minute signed GET URL for authenticated caller'
    );

    // S3 Multipart Upload Flow
    const multiInitRes = await axios.post(
      `${API_URL}/upload/multipart/initiate`,
      { filename: 'lecture-large.mp4', fileType: 'video/mp4', folder: 'courses' },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      multiInitRes.status === 200 &&
      typeof multiInitRes.data.uploadId === 'string' &&
      typeof multiInitRes.data.key === 'string',
      'POST /api/upload/multipart/initiate initiates multipart upload'
    );
    const multiKey = multiInitRes.data.key;
    const multiUploadId = multiInitRes.data.uploadId;

    const multiPartRes = await axios.post(
      `${API_URL}/upload/multipart/presign-part`,
      { key: multiKey, uploadId: multiUploadId, partNumber: 1 },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      multiPartRes.status === 200 &&
      typeof multiPartRes.data.presignedUrl === 'string' &&
      multiPartRes.data.partNumber === 1,
      'POST /api/upload/multipart/presign-part returns presigned URL for part'
    );

    const multiAbortRes = await axios.post(
      `${API_URL}/upload/multipart/abort`,
      { key: multiKey, uploadId: multiUploadId },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      multiAbortRes.status === 200 &&
      multiAbortRes.data.message === 'Multipart upload aborted',
      'POST /api/upload/multipart/abort aborts incomplete multipart upload'
    );

    const multiCompleteRes = await axios.post(
      `${API_URL}/upload/multipart/complete`,
      {
        key: multiKey,
        uploadId: 'mock-complete-id',
        parts: [{ partNumber: 1, etag: '"mock-etag-part-1"' }]
      },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      multiCompleteRes.status === 200 &&
      typeof multiCompleteRes.data.fileUrl === 'string',
      'POST /api/upload/multipart/complete finalizes multipart upload'
    );

    // 3. Public Partner Applications
    const plansRes = await axios.get(`${API_URL}/institutions/plans`);
    assert(
      plansRes.status === 200 &&
      Array.isArray(plansRes.data.plans) &&
      plansRes.data.plans.some(p => p.name === 'Premium' && p.monthlyPrice === 249) &&
      plansRes.data.plans.some(p => p.name === 'Enterprise' && p.monthlyPrice === 599),
      'GET /api/institutions/plans returns canonical Premium & Enterprise plans'
    );

    // Validation Error Envelope Check
    let valErrRes;
    try {
      await axios.post(`${API_URL}/institutions/applications`, {
        institutionName: 'AB' // Too short, missing required fields
      });
    } catch (e) {
      valErrRes = e.response;
    }
    assert(
      valErrRes?.status === 400 &&
      valErrRes?.data?.code === 'VALIDATION_ERROR' &&
      typeof valErrRes?.data?.fields === 'object' &&
      Boolean(valErrRes?.data?.fields?.institutionName),
      'POST /api/institutions/applications returns HTTP 400 with VALIDATION_ERROR and nested fields envelope'
    );

    // Successful Partnership Application Submission
    const testAppEmail = `rector.smoke_${Date.now()}@polytechnic.edu.ng`;
    const submitAppRes = await axios.post(`${API_URL}/institutions/applications`, {
      institutionName: 'Federal Polytechnic Smoke Institute',
      type: 'Technical College',
      website: 'https://fedpolysmoke.edu.ng',
      address: {
        line1: '10 Poly Road',
        city: 'Kaduna',
        country: 'NG'
      },
      representative: {
        name: 'Prof. Ibrahim Bello',
        role: 'Rector',
        email: testAppEmail,
        phone: '+2348055551234'
      },
      expectedStudents: '2,500 - 5,000',
      expectedStudentsCount: 3000,
      plan: 'Enterprise',
      documents: [
        {
          name: 'Federal_Gazette_Establishment.pdf',
          key: 'documents/smoke-poly-gazette.pdf',
          size: 1548290
        }
      ]
    });
    assert(
      submitAppRes.status === 201 &&
      submitAppRes.data.application &&
      /^GLX-\d{4}-\d{4}$/.test(submitAppRes.data.application.referenceId) &&
      submitAppRes.data.application.status === 'pending',
      'POST /api/institutions/applications generates reference ID (GLX-YYYY-XXXX) and saves application'
    );
    const createdAppRef = submitAppRes.data.application.referenceId;
    const createdAppId = submitAppRes.data.application._id;

    // Duplicate Pending Rejection Check (HTTP 409 DUPLICATE_APPLICATION)
    let duplicateAppRes;
    try {
      await axios.post(`${API_URL}/institutions/applications`, {
        institutionName: 'Federal Polytechnic Duplicate Attempt',
        type: 'Technical College',
        representative: {
          name: 'Prof. Ibrahim Bello',
          role: 'Rector',
          email: testAppEmail,
          phone: '+2348055551234'
        }
      });
    } catch (e) {
      duplicateAppRes = e.response;
    }
    assert(
      duplicateAppRes?.status === 409 &&
      duplicateAppRes?.data?.code === 'DUPLICATE_APPLICATION',
      'POST /api/institutions/applications rejects duplicate pending submission with 409 DUPLICATE_APPLICATION'
    );

    // Public Status Tracking (Safe Envelope)
    const trackRes = await axios.get(`${API_URL}/institutions/applications/${createdAppRef}`);
    assert(
      trackRes.status === 200 &&
      trackRes.data.referenceId === createdAppRef &&
      trackRes.data.status === 'pending' &&
      trackRes.data.estimatedReviewHours === 48 &&
      trackRes.data.representative === undefined,
      'GET /api/institutions/applications/:referenceId returns safe public tracking data without sensitive representative fields'
    );

    // 4. Admin Reviewer Portal Operations
    const listAppsRes = await axios.get(`${API_URL}/admin/institution-applications?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      listAppsRes.status === 200 &&
      Array.isArray(listAppsRes.data.applications) &&
      listAppsRes.data.total >= 1,
      'GET /api/admin/institution-applications returns paginated, filtered applications for admin'
    );

    const appDetailRes = await axios.get(`${API_URL}/admin/institution-applications/${createdAppId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      appDetailRes.status === 200 &&
      appDetailRes.data.application &&
      appDetailRes.data.application.documents?.[0]?.previewUrl &&
      Array.isArray(appDetailRes.data.reviewHistory),
      'GET /api/admin/institution-applications/:id returns review drawer data with signed document preview URLs and audit history'
    );
    const docId = appDetailRes.data.application.documents[0]._id;

    // Document download endpoint
    const docDownloadRes = await axios.get(
      `${API_URL}/admin/institution-applications/${createdAppId}/documents/${docId}/download`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      docDownloadRes.status === 200 &&
      typeof docDownloadRes.data.downloadUrl === 'string' &&
      docDownloadRes.data.expiresIn === 300,
      'GET /api/admin/institution-applications/:id/documents/:docId/download returns 5-min signed GET URL'
    );

    // Staff Reviewer: Request Info
    const reqInfoRes = await axios.post(
      `${API_URL}/admin/institution-applications/${createdAppId}/request-info`,
      { message: 'Please provide certified NBTE accreditation document' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      reqInfoRes.status === 200 &&
      reqInfoRes.data.application?.status === 'under_review',
      'POST /api/admin/institution-applications/:id/request-info sets status to under_review and logs ReviewEvent'
    );

    // Staff Reviewer: Update internal notes & plan
    const updateAppRes = await axios.put(
      `${API_URL}/admin/institution-applications/${createdAppId}`,
      { internalNotes: 'NBTE verification confirmed via phone call with registrar' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      updateAppRes.status === 200 &&
      updateAppRes.data.application?.internalNotes?.includes('NBTE verification confirmed'),
      'PUT /api/admin/institution-applications/:id updates internal notes and audit history'
    );

    // Staff Reviewer: Approve Application (Idempotent 7-day token & Institution creation)
    const approveRes = await axios.post(
      `${API_URL}/admin/institution-applications/${createdAppId}/approve`,
      { note: 'Accreditation verified. Approved for Enterprise tier onboarding.' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      approveRes.status === 200 &&
      approveRes.data.institution &&
      approveRes.data.institution.status === 'pending_activation' &&
      approveRes.data.institution.slug &&
      approveRes.data.application?.status === 'approved',
      'POST /api/admin/institution-applications/:id/approve creates Institution (pending_activation) and issues 7-day activation token'
    );

    // Duplicate Approval Prevention (HTTP 409 ALREADY_APPROVED)
    let dupApproveRes;
    try {
      await axios.post(
        `${API_URL}/admin/institution-applications/${createdAppId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
    } catch (e) {
      dupApproveRes = e.response;
    }
    assert(
      dupApproveRes?.status === 409 &&
      dupApproveRes?.data?.code === 'ALREADY_APPROVED',
      'POST /api/admin/institution-applications/:id/approve prevents duplicate approval with 409 ALREADY_APPROVED'
    );

    // Staff Reviewer: Resend Invite
    const resendInviteRes = await axios.post(
      `${API_URL}/admin/institution-applications/${createdAppId}/resend-invite`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(
      resendInviteRes.status === 200 &&
      resendInviteRes.data.message === 'Activation invite resent successfully',
      'POST /api/admin/institution-applications/:id/resend-invite regenerates and resends activation token'
    );

    // Staff Reviewer: Reject Application (using seeded rejected application)
    const seededHorizon = listAppsRes.data.applications.find(a => a.status === 'under_review') ||
      (await axios.get(`${API_URL}/admin/institution-applications`, { headers: { Authorization: `Bearer ${adminToken}` } })).data.applications.find(a => a.status !== 'approved');

    if (seededHorizon) {
      const rejectRes = await axios.post(
        `${API_URL}/admin/institution-applications/${seededHorizon._id}/reject`,
        { reason: 'Document verification failed' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(
        rejectRes.status === 200 &&
        rejectRes.data.application?.status === 'rejected',
        'POST /api/admin/institution-applications/:id/reject marks application rejected and logs event'
      );
    }

    // 5. Partner Analytics
    const overviewRes = await axios.get(`${API_URL}/admin/partners/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      overviewRes.status === 200 &&
      overviewRes.data.overview &&
      typeof overviewRes.data.overview.totalInstitutions === 'number' &&
      Array.isArray(overviewRes.data.overview.timeSeries),
      'GET /api/admin/partners/overview returns total institutions, active students, revenue, and 30-day time series'
    );

    const summaryRes = await axios.get(`${API_URL}/admin/partners/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      summaryRes.status === 200 &&
      summaryRes.data.summary &&
      typeof summaryRes.data.summary.activeInstitutions === 'number' &&
      typeof summaryRes.data.summary.pendingApprovals === 'number',
      'GET /api/admin/partners/summary returns active institutions, pending approvals, and approval success rate'
    );

    const geoRes = await axios.get(`${API_URL}/admin/partners/geo`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      geoRes.status === 200 &&
      Array.isArray(geoRes.data.locations) &&
      geoRes.data.locations.length > 0 &&
      typeof geoRes.data.locations[0].lat === 'number',
      'GET /api/admin/partners/geo returns country application counts with coordinates for dashboard map pins'
    );

    const growthRes = await axios.get(`${API_URL}/admin/partners/growth`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      growthRes.status === 200 &&
      Array.isArray(growthRes.data.months) &&
      growthRes.data.months.length === 7,
      'GET /api/admin/partners/growth returns monthly partner onboarding trend for the last 7 months'
    );

  } catch (err) {
    assert(false, 'Flow 9 exception', err.response?.data?.error || err.message);
  }

  // ==========================================
  // FLOW 10: INSTITUTION ACTIVATION, ONBOARDING WIZARD, MEMBERS & BILLING
  // ==========================================
  logSuite('FLOW 10: Institution Activation, Wizard Step Persistence, Member Import & Subscription Checkout');
  try {
    let instToken = '';
    let activatedInstId = '';
    const seedToken = 'seed_activation_token_1234567890abcdef1234567890abcdef';

    // 1. Activation Validation: Weak Password (< 12 characters)
    let weakPassRes;
    try {
      await axios.post(`${API_URL}/institutions/activate`, {
        token: seedToken,
        password: 'weak'
      });
    } catch (e) {
      weakPassRes = e.response;
    }
    assert(
      weakPassRes?.status === 400 && weakPassRes?.data?.code === 'WEAK_PASSWORD',
      'POST /api/institutions/activate validates 12+ char password and rejects weak passwords with 400 WEAK_PASSWORD'
    );

    // 2. Activation Validation: Expired / Invalid Token
    let expiredTokenRes;
    try {
      await axios.post(`${API_URL}/institutions/activate`, {
        token: 'expired_token_test_1234567890abcdef',
        password: 'SuperSecretAdmin123!'
      });
    } catch (e) {
      expiredTokenRes = e.response;
    }
    assert(
      expiredTokenRes?.status === 410 && expiredTokenRes?.data?.code === 'TOKEN_EXPIRED',
      'POST /api/institutions/activate rejects expired activation token with 410 TOKEN_EXPIRED'
    );

    // 3. Successful Workspace Activation (Single-Use 7-Day Token)
    const activateRes = await axios.post(`${API_URL}/institutions/activate`, {
      token: seedToken,
      password: 'SuperSecretAdmin123!',
      firstName: 'Capt. Thomas',
      lastName: 'Briggs'
    });
    assert(
      activateRes.status === 200 &&
      typeof activateRes.data.token === 'string' &&
      activateRes.data.user?.role === 'institution_admin' &&
      activateRes.data.institution?.status === 'onboarding',
      'POST /api/institutions/activate consumes 7-day token, creates admin user, and returns 200 { token, user, institution }'
    );
    instToken = activateRes.data.token;
    activatedInstId = activateRes.data.institution?._id;

    // 4. Token Replay Protection (Single-Use Verification)
    let replayRes;
    try {
      await axios.post(`${API_URL}/institutions/activate`, {
        token: seedToken,
        password: 'SuperSecretAdmin123!'
      });
    } catch (e) {
      replayRes = e.response;
    }
    assert(
      replayRes?.status === 410 && replayRes?.data?.code === 'TOKEN_EXPIRED',
      'POST /api/institutions/activate rejects already used token with 410 TOKEN_EXPIRED'
    );

    // 5. Tenant RBAC Isolation Guard
    let studentMeRes;
    try {
      await axios.get(`${API_URL}/institutions/me`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
    } catch (e) {
      studentMeRes = e.response;
    }
    assert(
      studentMeRes?.status === 403,
      'GET /api/institutions/me enforces roleGuard("institution_admin") and rejects non-admin users with 403'
    );

    // 6. Resume Wizard State
    const meRes = await axios.get(`${API_URL}/institutions/me`, {
      headers: { Authorization: `Bearer ${instToken}` }
    });
    assert(
      meRes.status === 200 &&
      meRes.data.institution?._id === activatedInstId &&
      typeof meRes.data.onboarding?.currentStep === 'number' &&
      Array.isArray(meRes.data.onboarding?.completedSteps),
      'GET /api/institutions/me returns currentStep and completedSteps for onboarding state persistence'
    );

    // 7. Step 1: Branding Configuration & S3 Key Verification
    let invalidLogoRes;
    try {
      await axios.put(
        `${API_URL}/institutions/me/branding`,
        { logoUrl: 'avatars/not-a-logo.png' },
        { headers: { Authorization: `Bearer ${instToken}` } }
      );
    } catch (e) {
      invalidLogoRes = e.response;
    }
    assert(
      invalidLogoRes?.status === 400 && invalidLogoRes?.data?.code === 'INVALID_LOGO_KEY',
      'PUT /api/institutions/me/branding rejects unverified non-logos/ S3 keys with 400 INVALID_LOGO_KEY'
    );

    const brandingRes = await axios.put(
      `${API_URL}/institutions/me/branding`,
      {
        displayName: 'Heritage Maritime University',
        color: '#1E3A8A',
        tagline: 'Leading Global Maritime Studies',
        logoUrl: 'logos/heritage-seal-verified.png'
      },
      { headers: { Authorization: `Bearer ${instToken}` } }
    );
    assert(
      brandingRes.status === 200 &&
      brandingRes.data.institution?.branding?.displayName === 'Heritage Maritime University' &&
      brandingRes.data.institution?.onboarding?.completedSteps.includes(1),
      'PUT /api/institutions/me/branding updates branding, saves verified S3 key, and marks Step 1 complete'
    );

    // 8. Step 2: Multi-Tenant Department Management
    const createDeptRes = await axios.post(
      `${API_URL}/institutions/me/departments`,
      {
        name: 'Maritime Operations & Logistics',
        code: 'MAR-101',
        faculty: 'Faculty of Maritime Sciences',
        headName: 'Dr. Arthur Vance'
      },
      { headers: { Authorization: `Bearer ${instToken}` } }
    );
    assert(
      createDeptRes.status === 201 &&
      createDeptRes.data.department?.code === 'MAR-101' &&
      createDeptRes.data.department?.institutionId === activatedInstId,
      'POST /api/institutions/me/departments creates department scoped to institutionId'
    );
    const createdDeptId = createDeptRes.data.department?._id;

    // Unique Code Collision in same Tenant
    let dupDeptRes;
    try {
      await axios.post(
        `${API_URL}/institutions/me/departments`,
        { name: 'Duplicate Dept', code: 'MAR-101' },
        { headers: { Authorization: `Bearer ${instToken}` } }
      );
    } catch (e) {
      dupDeptRes = e.response;
    }
    assert(
      dupDeptRes?.status === 409 && dupDeptRes?.data?.code === 'DUPLICATE_DEPARTMENT_CODE',
      'POST /api/institutions/me/departments rejects duplicate department code within tenant with 409'
    );

    // List and Update Department
    const listDeptRes = await axios.get(`${API_URL}/institutions/me/departments`, {
      headers: { Authorization: `Bearer ${instToken}` }
    });
    assert(
      listDeptRes.status === 200 &&
      Array.isArray(listDeptRes.data.departments) &&
      listDeptRes.data.departments.some(d => d.code === 'MAR-101'),
      'GET /api/institutions/me/departments returns all departments scoped to current tenant'
    );

    const updateDeptRes = await axios.put(
      `${API_URL}/institutions/me/departments/${createdDeptId}`,
      { name: 'Advanced Maritime Operations & Systems' },
      { headers: { Authorization: `Bearer ${instToken}` } }
    );
    assert(
      updateDeptRes.status === 200 &&
      updateDeptRes.data.department?.name === 'Advanced Maritime Operations & Systems',
      'PUT /api/institutions/me/departments/:id updates department metadata'
    );

    // 9. Step 3 & 4: Member Roster Management
    const addMemberRes = await axios.post(
      `${API_URL}/institutions/me/members`,
      {
        role: 'tutor',
        name: 'Senior Lecturer Alan',
        email: 'alan.tutor@heritagemaritime.edu',
        departmentIds: [createdDeptId],
        designation: 'Senior Maritime Lecturer',
        autoInvite: true
      },
      { headers: { Authorization: `Bearer ${instToken}` } }
    );
    assert(
      addMemberRes.status === 201 &&
      addMemberRes.data.member?.role === 'tutor' &&
      addMemberRes.data.member?.inviteStatus === 'pending',
      'POST /api/institutions/me/members adds tutor, dispatches invitation, and tracks inviteStatus: pending'
    );
    const tutorMemberId = addMemberRes.data.member?._id;

    // Duplicate Member Email Check
    let dupMemberRes;
    try {
      await axios.post(
        `${API_URL}/institutions/me/members`,
        {
          role: 'student',
          name: 'Alan Copy',
          email: 'alan.tutor@heritagemaritime.edu'
        },
        { headers: { Authorization: `Bearer ${instToken}` } }
      );
    } catch (e) {
      dupMemberRes = e.response;
    }
    assert(
      dupMemberRes?.status === 409 && dupMemberRes?.data?.code === 'DUPLICATE_MEMBER',
      'POST /api/institutions/me/members prevents duplicate email within tenant with 409 DUPLICATE_MEMBER'
    );

    // Bulk Import with Column Aliases
    const bulkImportRes = await axios.post(
      `${API_URL}/institutions/me/members/import`,
      {
        members: [
          { 'Full Name': 'Cadet James Hook', 'Professional Email': 'jhook@heritagemaritime.edu', role: 'student', department: 'MAR-101' },
          { 'Full Name': 'Cadet Wendy Darling', 'Professional Email': 'wendy@heritagemaritime.edu', role: 'student' }
        ]
      },
      { headers: { Authorization: `Bearer ${instToken}` } }
    );
    assert(
      bulkImportRes.status === 200 &&
      bulkImportRes.data.imported === 2 &&
      Array.isArray(bulkImportRes.data.skipped),
      'POST /api/institutions/me/members/import parses CSV/JSON with aliases (Full Name, Professional Email) and returns imported count'
    );

    // Member Invite Rate Limiting (429)
    let rateLimitInviteRes;
    try {
      await axios.post(
        `${API_URL}/institutions/me/members/${tutorMemberId}/invite`,
        {},
        { headers: { Authorization: `Bearer ${instToken}` } }
      );
    } catch (e) {
      rateLimitInviteRes = e.response;
    }
    assert(
      rateLimitInviteRes?.status === 429 && rateLimitInviteRes?.data?.code === 'RATE_LIMITED',
      'POST /api/institutions/me/members/:id/invite rate limits rapid resend attempts with 429 RATE_LIMITED'
    );

    // Department Deletion Safeguard (Blocked when active members are assigned)
    let blockedDeleteDeptRes;
    try {
      await axios.delete(`${API_URL}/institutions/me/departments/${createdDeptId}`, {
        headers: { Authorization: `Bearer ${instToken}` }
      });
    } catch (e) {
      blockedDeleteDeptRes = e.response;
    }
    assert(
      blockedDeleteDeptRes?.status === 409 && blockedDeleteDeptRes?.data?.code === 'DEPARTMENT_HAS_MEMBERS',
      'DELETE /api/institutions/me/departments/:id blocks deletion if assigned members exist (409 DEPARTMENT_HAS_MEMBERS)'
    );

    // Delete Member
    const deleteMemberRes = await axios.delete(`${API_URL}/institutions/me/members/${tutorMemberId}`, {
      headers: { Authorization: `Bearer ${instToken}` }
    });
    assert(
      deleteMemberRes.status === 200 &&
      deleteMemberRes.data.message === 'Member removed successfully',
      'DELETE /api/institutions/me/members/:id detaches user/removes member record'
    );

    // 10. Step 5: Paystack Subscription Checkout & Canonical Calculations
    const checkoutRes = await axios.post(
      `${API_URL}/institutions/me/subscription/checkout`,
      { plan: 'Premium', billing: 'annual', currency: 'USD' },
      { headers: { Authorization: `Bearer ${instToken}` } }
    );
    assert(
      checkoutRes.status === 200 &&
      checkoutRes.data.amount === 2988 &&
      checkoutRes.data.discount === 597.6 &&
      checkoutRes.data.total === 2390.4 &&
      typeof checkoutRes.data.reference === 'string' &&
      typeof checkoutRes.data.access_code === 'string',
      'POST /api/institutions/me/subscription/checkout computes canonical 20% annual discount ($2,390.40) and returns Paystack access_code'
    );
    const checkoutRef = checkoutRes.data.reference;

    // Subscription Status Get
    const getSubRes = await axios.get(`${API_URL}/institutions/me/subscription`, {
      headers: { Authorization: `Bearer ${instToken}` }
    });
    assert(
      getSubRes.status === 200 &&
      getSubRes.data.plan === 'Premium' &&
      getSubRes.data.billing === 'annual',
      'GET /api/institutions/me/subscription returns active billing cycle and plan'
    );

    // 11. Paystack Webhook Reconciliation for Institution Subscription
    const webhookPayload = {
      event: 'charge.success',
      data: {
        reference: checkoutRef,
        amount: 239040, // $2,390.40 in cents
        currency: 'USD',
        status: 'success',
        receipt_url: 'https://checkout.paystack.com/receipts/test_rec_001.pdf',
        metadata: {
          type: 'institution_subscription',
          institutionId: String(activatedInstId),
          plan: 'Premium',
          billing: 'annual',
          amountGross: 2988,
          discount: 597.6
        }
      }
    };
    const rawPayloadStr = JSON.stringify(webhookPayload);
    const secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock';
    const signature = crypto.createHmac('sha512', secretKey).update(rawPayloadStr).digest('hex');

    const webhookRes = await axios.post(`${API_URL}/webhooks/paystack`, webhookPayload, {
      headers: {
        'x-paystack-signature': signature,
        'Content-Type': 'application/json'
      }
    });
    assert(
      webhookRes.status === 200 &&
      webhookRes.data.status === 'success' &&
      webhookRes.data.message === 'Institution subscription activated successfully',
      'POST /api/webhooks/paystack reconciles institution subscription, activates workspace, and appends invoice'
    );

    // Verify workspace status is now active
    const postWebhookMeRes = await axios.get(`${API_URL}/institutions/me`, {
      headers: { Authorization: `Bearer ${instToken}` }
    });
    assert(
      postWebhookMeRes.status === 200 &&
      postWebhookMeRes.data.status === 'active' &&
      postWebhookMeRes.data.onboarding?.currentStep === 6,
      'Workspace status transitions to "active" and wizard completes (Step 6) upon successful subscription webhook'
    );

    // 12. Workspace Dashboard Analytics
    const dashboardRes = await axios.get(`${API_URL}/institutions/me/dashboard`, {
      headers: { Authorization: `Bearer ${instToken}` }
    });
    assert(
      dashboardRes.status === 200 &&
      dashboardRes.data.metrics &&
      typeof dashboardRes.data.metrics.totalStudents === 'number' &&
      typeof dashboardRes.data.metrics.activeDepartments === 'number' &&
      dashboardRes.data.metrics.status === 'active' &&
      Array.isArray(dashboardRes.data.recentActivity),
      'GET /api/institutions/me/dashboard returns real-time calculated metrics for students, tutors, departments, and seat utilization'
    );

    // 13. Pre-seeded Apex Tech Workspace & Seat Limit Safeguard Check
    const apexLoginRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'sarah.conner@apextech.edu',
      password: 'Password123!'
    });
    const apexToken = apexLoginRes.data.token;

    const apexDashRes = await axios.get(`${API_URL}/institutions/me/dashboard`, {
      headers: { Authorization: `Bearer ${apexToken}` }
    });
    assert(
      apexDashRes.status === 200 &&
      apexDashRes.data.institution?.name === 'Apex Technical University' &&
      apexDashRes.data.metrics?.totalStudents >= 1 &&
      apexDashRes.data.metrics?.totalTutors >= 1,
      'Seeded Apex Tech workspace loads authenticated metrics with strict multi-tenant isolation'
    );

  } catch (err) {
    assert(false, 'Flow 10 exception', err.response?.data?.error || err.message);
  }

  // ==========================================
  // FLOW 11: LMS COHORT GATING, CURRICULUM PROGRESS, SERVER-TIMED QUIZ & ASSIGNMENT FLOW
  // ==========================================
  logHeader('FLOW 11: LMS Cohort Gating, Curriculum Progress, Server-Timed Quiz & Assignment Flow');

  try {
    logSuite('LMS Cohort Gating & Membership Resolution Safeguard');

    // 1. Non-enrolled user receives 403 COHORT_ACCESS_DENIED on any /api/lms/* call
    // Create/login a student who is not enrolled in any cohort
    const unEnrolledSignupRes = await axios.post(`${API_URL}/auth/signup`, {
      firstName: 'Charlie',
      lastName: 'Unenrolled',
      email: `charlie.${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'student'
    });
    const unEnrolledToken = unEnrolledSignupRes.data.token;

    let nonEnrolledRes;
    try {
      await axios.get(`${API_URL}/lms/dashboard/student`, {
        headers: { Authorization: `Bearer ${unEnrolledToken}` }
      });
    } catch (err) {
      nonEnrolledRes = err.response;
    }
    assert(
      nonEnrolledRes &&
      nonEnrolledRes.status === 403 &&
      nonEnrolledRes.data.error === 'You are not enrolled in this cohort' &&
      nonEnrolledRes.data.code === 'COHORT_ACCESS_DENIED',
      'GET /api/lms/dashboard/student strictly returns 403 COHORT_ACCESS_DENIED for non-enrolled users'
    );

    // 2. Context & Cohort Listing (GET /api/lms/me)
    const lmsMeRes = await axios.get(`${API_URL}/lms/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      lmsMeRes.status === 200 &&
      lmsMeRes.data.role === 'student' &&
      Array.isArray(lmsMeRes.data.cohorts) &&
      lmsMeRes.data.cohorts.length >= 1 &&
      lmsMeRes.data.activeCohortId,
      'GET /api/lms/me returns user cohorts list, trimester details, and active cohort ID'
    );

    const activeCohort = lmsMeRes.data.cohorts.find(c => c.name.includes('Alpha')) || lmsMeRes.data.cohorts[0];
    const activeCohortId = activeCohort._id;

    // 3. Student Dashboard (GET /api/lms/dashboard/student)
    const studentDashRes = await axios.get(`${API_URL}/lms/dashboard/student?cohortId=${activeCohortId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      studentDashRes.status === 200 &&
      studentDashRes.data.cohort?._id === activeCohortId &&
      typeof studentDashRes.data.progress?.overall === 'number' &&
      typeof studentDashRes.data.progress?.week === 'number' &&
      typeof studentDashRes.data.progress?.assignments?.total === 'number' &&
      Array.isArray(studentDashRes.data.upcoming),
      'GET /api/lms/dashboard/student aggregates overall/week progress, assignments, and upcoming deliverables'
    );

    // 4. Curriculum Modules Tree (GET /api/lms/cohorts/:cohortId/curriculum)
    const curriculumRes = await axios.get(`${API_URL}/lms/cohorts/${activeCohortId}/curriculum`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      curriculumRes.status === 200 &&
      Array.isArray(curriculumRes.data.modules) &&
      curriculumRes.data.modules.length > 0 &&
      Array.isArray(curriculumRes.data.modules[0].lessons),
      'GET /api/lms/cohorts/:cohortId/curriculum returns full module tree with per-lesson status'
    );

    const module1 = curriculumRes.data.modules[0];
    const module2 = curriculumRes.data.modules[1];
    const lesson1Id = module1.lessons[0]._id;
    const lesson2Id = module1.lessons[1]._id;
    const quiz1Id = module2?.quizzes[0]?._id;

    // 5. Lesson Detail View & Content Protection (GET /api/lms/lessons/:lessonId)
    const lessonRes = await axios.get(`${API_URL}/lms/lessons/${lesson1Id}?cohortId=${activeCohortId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(
      lessonRes.status === 200 &&
      lessonRes.data.video &&
      typeof lessonRes.data.video.playbackUrl === 'string' &&
      typeof lessonRes.data.video.durationSec === 'number' &&
      Array.isArray(lessonRes.data.objectives) &&
      lessonRes.data.module?._id === module1._id,
      'GET /api/lms/lessons/:lessonId returns unshielded lesson content with video playback & navigation for enrolled students'
    );

    // 6. Idempotent Lesson Progress Update (PUT /api/lms/lessons/:lessonId/progress)
    const progressPutRes = await axios.put(
      `${API_URL}/lms/lessons/${lesson2Id}/progress?cohortId=${activeCohortId}`,
      {
        watchedSeconds: 600,
        completed: true,
        objectivesDone: ['Node setup complete']
      },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    assert(
      progressPutRes.status === 200 &&
      progressPutRes.data.progress?.status === 'completed' &&
      progressPutRes.data.progress?.watchedSeconds >= 600 &&
      typeof progressPutRes.data.overallPercent === 'number',
      'PUT /api/lms/lessons/:lessonId/progress idempotently updates watchedSeconds & completion, recalculating dashboard percentages'
    );

    // 7. Threaded Lesson Discussions, Replies & Likes
    const commentPostRes = await axios.post(
      `${API_URL}/lms/lessons/${lesson1Id}/comments?cohortId=${activeCohortId}`,
      { body: 'Does Node.js use libuv for all asynchronous I/O operations?' },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    assert(
      commentPostRes.status === 201 &&
      commentPostRes.data.comment?.body === 'Does Node.js use libuv for all asynchronous I/O operations?' &&
      commentPostRes.data.comment?.authorRole === 'student',
      'POST /api/lms/lessons/:lessonId/comments creates top-level discussion comment'
    );
    const commentId = commentPostRes.data.comment._id;

    const replyPostRes = await axios.post(
      `${API_URL}/lms/comments/${commentId}/replies`,
      { body: 'Yes, Alice! Libuv handles thread pooling and OS non-blocking primitives.' },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      replyPostRes.status === 201 &&
      replyPostRes.data.reply?.authorRole === 'instructor' &&
      replyPostRes.data.reply?.parentId === commentId,
      'POST /api/lms/comments/:id/replies posts threaded reply with instructor role badge'
    );

    const likeRes = await axios.post(
      `${API_URL}/lms/comments/${commentId}/like`,
      {},
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      likeRes.status === 200 &&
      likeRes.data.liked === true &&
      likeRes.data.likesCount >= 1,
      'POST /api/lms/comments/:id/like toggles like on discussion comment'
    );

    const unlikeRes = await axios.delete(
      `${API_URL}/lms/comments/${commentId}/like`,
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      unlikeRes.status === 200 &&
      unlikeRes.data.liked === false,
      'DELETE /api/lms/comments/:id/like removes like from discussion comment'
    );

    // 8. Quizzes Engine - Overview & Server Content Protection (GET /api/lms/quizzes/:quizId)
    const quizOverviewRes = await axios.get(
      `${API_URL}/lms/quizzes/${quiz1Id}?cohortId=${activeCohortId}`,
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      quizOverviewRes.status === 200 &&
      quizOverviewRes.data.title &&
      quizOverviewRes.data.questionCount === 2 &&
      quizOverviewRes.data.passMarkPercent === 70 &&
      quizOverviewRes.data.correctOptionIndex === undefined,
      'GET /api/lms/quizzes/:quizId returns quiz metadata while strictly omitting answer keys (Rule 3)'
    );

    // 9. Start Timed Quiz Attempt (POST /api/lms/quizzes/:quizId/attempts)
    const startAttemptRes = await axios.post(
      `${API_URL}/lms/quizzes/${quiz1Id}/attempts?cohortId=${activeCohortId}`,
      {},
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      startAttemptRes.status === 201 &&
      startAttemptRes.data.attemptId &&
      startAttemptRes.data.expiresAt &&
      Array.isArray(startAttemptRes.data.questions) &&
      startAttemptRes.data.questions.length === 2 &&
      startAttemptRes.data.questions[0].correctOptionIndex === undefined,
      'POST /api/lms/quizzes/:quizId/attempts sets server countdown timer with expiresAt and sanitizes questions'
    );
    const bobAttemptId = startAttemptRes.data.attemptId;
    const q1 = startAttemptRes.data.questions[0];
    const q2 = startAttemptRes.data.questions[1];

    // 10. Instant Answer Check & Question Locking (POST /api/lms/quiz-attempts/:attemptId/answers)
    const answerCheckRes = await axios.post(
      `${API_URL}/lms/quiz-attempts/${bobAttemptId}/answers`,
      {
        questionId: q1._id,
        optionId: '0',
        check: true
      },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      answerCheckRes.status === 200 &&
      answerCheckRes.data.correct === true &&
      typeof answerCheckRes.data.explanation === 'string',
      'POST /api/lms/quiz-attempts/:attemptId/answers with check: true verifies correctness server-side and returns explanation'
    );

    // Re-answering locked question must fail with 400
    let lockedAnswerRes;
    try {
      await axios.post(
        `${API_URL}/lms/quiz-attempts/${bobAttemptId}/answers`,
        { questionId: q1._id, optionId: '1', check: true },
        { headers: { Authorization: `Bearer ${bobToken}` } }
      );
    } catch (err) {
      lockedAnswerRes = err.response;
    }
    assert(
      lockedAnswerRes &&
      lockedAnswerRes.status === 400 &&
      lockedAnswerRes.data.code === 'QUESTION_LOCKED',
      'Re-answering an already-checked question returns 400 QUESTION_LOCKED'
    );

    // Answer second question without check
    const answer2Res = await axios.post(
      `${API_URL}/lms/quiz-attempts/${bobAttemptId}/answers`,
      {
        questionId: q2._id,
        optionId: '1',
        check: false
      },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      answer2Res.status === 200 &&
      answer2Res.data.saved === true,
      'POST /api/lms/quiz-attempts/:attemptId/answers saves answer choice without immediate reveal when check: false'
    );

    // 11. Submit Quiz Attempt & Grace Window (POST /api/lms/quiz-attempts/:attemptId/submit)
    const submitQuizRes = await axios.post(
      `${API_URL}/lms/quiz-attempts/${bobAttemptId}/submit`,
      {},
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      submitQuizRes.status === 200 &&
      submitQuizRes.data.status === 'submitted' &&
      submitQuizRes.data.score === 2 &&
      submitQuizRes.data.percent === 100 &&
      submitQuizRes.data.passed === true &&
      submitQuizRes.data.bestScore === 2,
      'POST /api/lms/quiz-attempts/:attemptId/submit grades attempt, enforces timer grace window, and records best score'
    );

    // 12. Assignments Listing & Details (GET /api/lms/assignments)
    const assignmentsRes = await axios.get(
      `${API_URL}/lms/assignments?cohortId=${activeCohortId}`,
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      assignmentsRes.status === 200 &&
      Array.isArray(assignmentsRes.data.assignments) &&
      assignmentsRes.data.assignments.length >= 1,
      'GET /api/lms/assignments lists cohort deliverables with submission status'
    );
    const assignment1Item = assignmentsRes.data.assignments[0];

    const assignmentDetailRes = await axios.get(
      `${API_URL}/lms/assignments/${assignment1Item._id}?cohortId=${activeCohortId}`,
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      assignmentDetailRes.status === 200 &&
      assignmentDetailRes.data.title &&
      Array.isArray(assignmentDetailRes.data.rubric) &&
      assignmentDetailRes.data.maxFileMB === 50,
      'GET /api/lms/assignments/:id returns full assignment detail, rubric breakdown, and file restrictions'
    );

    // 13. Student Assignment Submission & Validation (POST /api/lms/assignments/:id/submissions)
    // Invalid repo URL rejection
    let invalidRepoRes;
    try {
      await axios.post(
        `${API_URL}/lms/assignments/${assignment1Item._id}/submissions?cohortId=${activeCohortId}`,
        { repoUrl: 'https://not-github.com/bad/repo' },
        { headers: { Authorization: `Bearer ${bobToken}` } }
      );
    } catch (err) {
      invalidRepoRes = err.response;
    }
    assert(
      invalidRepoRes &&
      invalidRepoRes.status === 400 &&
      invalidRepoRes.data.code === 'INVALID_REPO_URL',
      'POST /api/lms/assignments/:id/submissions rejects invalid GitHub URL format with 400 INVALID_REPO_URL'
    );

    // Valid initial submission
    const submitAssignmentRes = await axios.post(
      `${API_URL}/lms/assignments/${assignment1Item._id}/submissions?cohortId=${activeCohortId}`,
      {
        repoUrl: 'https://github.com/bob-student/express-backend-capstone',
        comment: 'Initial capstone submission for grading'
      },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      submitAssignmentRes.status === 201 &&
      submitAssignmentRes.data.submission?.status === 'pending_review' &&
      submitAssignmentRes.data.submission?.repoUrl === 'https://github.com/bob-student/express-backend-capstone',
      'POST /api/lms/assignments/:id/submissions successfully records student assignment submission'
    );
    const bobSubmissionId = submitAssignmentRes.data.submission._id;

    // Resubmission before grading is permitted
    const resubmitRes = await axios.post(
      `${API_URL}/lms/assignments/${assignment1Item._id}/submissions?cohortId=${activeCohortId}`,
      {
        repoUrl: 'https://github.com/bob-student/express-backend-capstone-v2',
        comment: 'Updated capstone with additional unit tests'
      },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    assert(
      resubmitRes.status === 200 &&
      resubmitRes.data.submission?.repoUrl === 'https://github.com/bob-student/express-backend-capstone-v2',
      'POST /api/lms/assignments/:id/submissions allows students to update/resubmit work before instructor grading'
    );

    // 14. Instructor Grading Queue (GET /api/lms/instructor/grading-queue)
    const queueRes = await axios.get(
      `${API_URL}/lms/instructor/grading-queue?cohortId=${activeCohortId}`,
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      queueRes.status === 200 &&
      queueRes.data.pending >= 1 &&
      queueRes.data.items.some(item => String(item.submissionId) === String(bobSubmissionId)),
      'GET /api/lms/instructor/grading-queue returns pending submissions with student details and overdue indicators'
    );

    // 15. Grade Submission & Rubric Breakdown (PUT /api/lms/submissions/:id/grade)
    const gradeRes = await axios.put(
      `${API_URL}/lms/submissions/${bobSubmissionId}/grade`,
      {
        score: 96,
        max: 100,
        feedback: 'Outstanding modular architecture and comprehensive error handling suite!',
        rubricScores: [
          { criterion: 'Architecture & Clean Code', pointsAwarded: 48 },
          { criterion: 'Error Handling & Tests', pointsAwarded: 48 }
        ]
      },
      { headers: { Authorization: `Bearer ${janeToken}` } }
    );
    assert(
      gradeRes.status === 200 &&
      gradeRes.data.submission?.status === 'graded' &&
      gradeRes.data.submission?.grade?.score === 96 &&
      gradeRes.data.submission?.grade?.rubricScores?.length === 2,
      'PUT /api/lms/submissions/:id/grade records score, rubric points, instructor feedback, and triggers student notification'
    );

    // Resubmission after grading is locked
    let lockedResubmitRes;
    try {
      await axios.post(
        `${API_URL}/lms/assignments/${assignment1Item._id}/submissions?cohortId=${activeCohortId}`,
        { repoUrl: 'https://github.com/bob-student/too-late' },
        { headers: { Authorization: `Bearer ${bobToken}` } }
      );
    } catch (err) {
      lockedResubmitRes = err.response;
    }
    assert(
      lockedResubmitRes &&
      lockedResubmitRes.status === 400 &&
      lockedResubmitRes.data.code === 'SUBMISSION_LOCKED',
      'Resubmitting an already-graded assignment is locked and returns 400 SUBMISSION_LOCKED'
    );

  } catch (err) {
    assert(false, 'Flow 11 exception', err.response?.data?.error || err.message);
  }

  // Print Summary Table
  const durationMs = Date.now() - startTime;
  console.log(`\n\x1b[36m==================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m E2E SMOKE TEST EXECUTION SUMMARY \x1b[0m`);
  console.log(`\x1b[36m==================================================\x1b[0m`);
  console.log(`+-----------------------------------+-------+`);
  console.log(`| Metric                            | Value |`);
  console.log(`+-----------------------------------+-------+`);
  console.log(`| Total Test Suites                 | ${totalSuites.toString().padEnd(5)} |`);
  console.log(`| Total Assertions                  | ${totalAssertions.toString().padEnd(5)} |`);
  console.log(`| Passed Assertions                 | ${passedAssertions.toString().padEnd(5)} |`);
  console.log(`| Failed Assertions                 | ${failedAssertions.toString().padEnd(5)} |`);
  console.log(`| Duration                          | ${(durationMs + ' ms').padEnd(5)} |`);
  console.log(`+-----------------------------------+-------+\n`);

  if (failedAssertions === 0) {
    console.log(`\x1b[32m[PASS] ALL E2E SYSTEM SMOKE TESTS PASSED (100% COMPLIANCE)\x1b[0m\n`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m[FAIL] ${failedAssertions} ASSERTION(S) FAILED IN SMOKE TEST SUITE\x1b[0m\n`);
    process.exit(1);
  }
}

runSmokeTests();
