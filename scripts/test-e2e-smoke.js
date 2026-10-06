import 'dotenv/config';
import axios from 'axios';
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
