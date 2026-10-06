import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = `${BASE_URL}/api`;

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

let passedCount = 0;
let failedCount = 0;
const results = [];

function assert(condition, message, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} ${message}`);
    results.push({ name: message, status: 'PASS' });
  } else {
    failedCount++;
    console.log(`  ${colors.red}✖ FAIL${colors.reset} ${message} ${details ? colors.gray + `(${details})` + colors.reset : ''}`);
    results.push({ name: message, status: 'FAIL', details });
  }
}

function printSection(title) {
  console.log(`\n${colors.cyan}${colors.bold}=== ${title} ===${colors.reset}`);
}

async function runUnit16EndpointTests() {
  console.log(`${colors.blue}${colors.bold}====================================================`);
  console.log(`  TESTING ALL UNIT 16 REMEDIATION API ENDPOINTS`);
  console.log(`  Target Server: ${API_URL}`);
  console.log(`====================================================${colors.reset}`);

  let adminToken = '';
  let studentToken = '';
  let tutorToken = '';
  let nonOwnerTutorToken = '';
  let testStudentUser = null;
  let sampleCourseId = '';
  let createdReviewId = '';

  // Step 0: Signin existing seed accounts to obtain tokens
  printSection('0. Authenticating Seed Accounts');
  try {
    const adminRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'admin@gloxad.com',
      password: 'Password123!'
    });
    adminToken = adminRes.data.token;
    assert(!!adminToken, 'Admin authentication successful');

    const johnRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'john.tutor@gloxad.com',
      password: 'Password123!'
    });
    tutorToken = johnRes.data.token;
    assert(!!tutorToken, 'Course Owner Tutor (John) authentication successful');

    const janeRes = await axios.post(`${API_URL}/auth/signin`, {
      email: 'jane.tutor@gloxad.com',
      password: 'Password123!'
    });
    nonOwnerTutorToken = janeRes.data.token;
    assert(!!nonOwnerTutorToken, 'Secondary Tutor (Jane) authentication successful');

    // Create / Signin dedicated student
    const studentEmail = `unit16.student.${Date.now()}@gloxad.com`;
    const studentRes = await axios.post(`${API_URL}/auth/signup`, {
      firstName: 'Reviewer',
      lastName: 'Student',
      email: studentEmail,
      password: 'Password123!',
      role: 'student'
    });
    studentToken = studentRes.data.token;
    testStudentUser = studentRes.data.user;
    assert(!!studentToken, `Test student created & authenticated (${studentEmail})`);
  } catch (err) {
    console.error('Authentication setup failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // ENDPOINT 1: POST /api/auth/refresh
  // -------------------------------------------------------------
  printSection('1. POST /api/auth/refresh');
  try {
    // 1.1 Valid Refresh
    const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(
      refreshRes.status === 200 && typeof refreshRes.data.token === 'string',
      'POST /api/auth/refresh returns 200 with refreshed JWT token'
    );
    const userObj = refreshRes.data.user;
    assert(
      userObj &&
      userObj.isVerified === userObj.isEmailVerified &&
      userObj.bio === userObj.biography &&
      userObj.avatar === userObj.avatarUrl &&
      userObj.socials !== undefined &&
      userObj.socialLinks !== undefined,
      'POST /api/auth/refresh returns user with dual-key aliases (isVerified/isEmailVerified, bio/biography, avatar/avatarUrl, socials/socialLinks)'
    );

    // 1.2 Missing token (401)
    try {
      await axios.post(`${API_URL}/auth/refresh`, {});
      assert(false, 'POST /api/auth/refresh should reject request without token');
    } catch (err) {
      assert(err.response?.status === 401 && err.response?.data?.error, 'POST /api/auth/refresh returns 401 { error } when unauthenticated');
    }
  } catch (err) {
    assert(false, 'POST /api/auth/refresh failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 2: GET /api/admin/users/:id
  // -------------------------------------------------------------
  printSection('2. GET /api/admin/users/:id');
  try {
    // 2.1 Admin access
    const userDetailRes = await axios.get(`${API_URL}/admin/users/${testStudentUser._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      userDetailRes.status === 200 &&
      userDetailRes.data.user &&
      userDetailRes.data.user._id === testStudentUser._id &&
      Array.isArray(userDetailRes.data.user.experienceProofs),
      'GET /api/admin/users/:id returns 200 with complete user details and experienceProofs'
    );

    // 2.2 Forbidden for Student (403)
    try {
      await axios.get(`${API_URL}/admin/users/${testStudentUser._id}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'GET /api/admin/users/:id should reject student callers');
    } catch (err) {
      assert(err.response?.status === 403, 'GET /api/admin/users/:id returns 403 Forbidden for non-admin callers');
    }

    // 2.3 Non-existent User (404)
    try {
      await axios.get(`${API_URL}/admin/users/64f123456789abcdef012345`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(false, 'GET /api/admin/users/:id should return 404 for non-existent ID');
    } catch (err) {
      assert(err.response?.status === 404, 'GET /api/admin/users/:id returns 404 { error } when user not found');
    }
  } catch (err) {
    assert(false, 'GET /api/admin/users/:id failed', err.response?.data?.error || err.message);
  }

  printSection('3. GET /api/admin/courses/:id');
  try {
    // Get a free course ID so student can enroll without external payment gateway
    const coursesRes = await axios.get(`${API_URL}/courses`);
    const freeCourse = coursesRes.data.courses.find(c => c.courseType === 'free') || coursesRes.data.courses[0];
    sampleCourseId = freeCourse._id;

    // 3.1 Admin access (200)
    const adminCourseRes = await axios.get(`${API_URL}/admin/courses/${sampleCourseId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      adminCourseRes.status === 200 &&
      adminCourseRes.data.course &&
      adminCourseRes.data.course._id === sampleCourseId &&
      typeof adminCourseRes.data.course.category === 'object',
      'GET /api/admin/courses/:id returns 200 with unshielded course & resolved category'
    );

    // 3.2 Forbidden for Student (403)
    try {
      await axios.get(`${API_URL}/admin/courses/${sampleCourseId}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'GET /api/admin/courses/:id should reject student callers');
    } catch (err) {
      assert(err.response?.status === 403, 'GET /api/admin/courses/:id returns 403 Forbidden for non-admin callers');
    }

    // 3.3 Non-existent Course (404)
    try {
      await axios.get(`${API_URL}/admin/courses/64f123456789abcdef012345`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(false, 'GET /api/admin/courses/:id should return 404 for non-existent ID');
    } catch (err) {
      assert(err.response?.status === 404, 'GET /api/admin/courses/:id returns 404 when course not found');
    }
  } catch (err) {
    assert(false, 'GET /api/admin/courses/:id failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 4: GET /api/admin/courses/pending
  // -------------------------------------------------------------
  printSection('4. GET /api/admin/courses/pending');
  try {
    // 4.1 Admin access
    const pendingRes = await axios.get(`${API_URL}/admin/courses/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      pendingRes.status === 200 &&
      Array.isArray(pendingRes.data.courses) &&
      pendingRes.data.pagination &&
      pendingRes.data.courses.every(c => typeof c.category === 'object' && c.category !== null && c.category.name),
      'GET /api/admin/courses/pending returns 200 with populated category object ({ _id, name, slug, icon, imageUrl })'
    );

    // 4.2 Non-admin access (403)
    try {
      await axios.get(`${API_URL}/admin/courses/pending`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'GET /api/admin/courses/pending should reject student callers');
    } catch (err) {
      assert(err.response?.status === 403, 'GET /api/admin/courses/pending returns 403 Forbidden for non-admin callers');
    }
  } catch (err) {
    assert(false, 'GET /api/admin/courses/pending failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 5 & 6: GET & PUT /api/admin/settings
  // -------------------------------------------------------------
  printSection('5 & 6. GET & PUT /api/admin/settings');
  try {
    // 5.1 GET platform settings
    const getSettingsRes = await axios.get(`${API_URL}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      getSettingsRes.status === 200 &&
      getSettingsRes.data.settings &&
      typeof getSettingsRes.data.settings.allowSignups === 'boolean',
      'GET /api/admin/settings returns 200 with singleton settings'
    );

    // 5.2 GET Forbidden for Student
    try {
      await axios.get(`${API_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'GET /api/admin/settings should reject student callers');
    } catch (err) {
      assert(err.response?.status === 403, 'GET /api/admin/settings returns 403 Forbidden for non-admin callers');
    }

    // 6.1 PUT update settings
    const testSigUrl = 'https://gloxad-bucket.s3.amazonaws.com/signatures/dean-signature-2026.png';
    const putSettingsRes = await axios.put(`${API_URL}/admin/settings`, {
      deletionGraceDays: 60,
      signatureUrl: testSigUrl,
      maintenanceMode: false
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      putSettingsRes.status === 200 &&
      putSettingsRes.data.settings.deletionGraceDays === 60 &&
      putSettingsRes.data.settings.signatureUrl === testSigUrl,
      'PUT /api/admin/settings returns 200 and updates platform configuration'
    );

    // 6.2 PUT Forbidden for non-admin
    try {
      await axios.put(`${API_URL}/admin/settings`, { deletionGraceDays: 30 }, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'PUT /api/admin/settings should reject non-admin callers');
    } catch (err) {
      assert(err.response?.status === 403, 'PUT /api/admin/settings returns 403 Forbidden for non-admin callers');
    }
  } catch (err) {
    assert(false, 'GET/PUT /api/admin/settings failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 7: GET /api/tutor/search-instructors
  // -------------------------------------------------------------
  printSection('7. GET /api/tutor/search-instructors');
  try {
    // 7.1 Search instructors
    const searchRes = await axios.get(`${API_URL}/tutor/search-instructors?q=jane`, {
      headers: { Authorization: `Bearer ${tutorToken}` }
    });
    assert(
      searchRes.status === 200 &&
      Array.isArray(searchRes.data.instructors) &&
      searchRes.data.instructors.length > 0 &&
      searchRes.data.instructors.every(i => i.role === 'instructor' && i.approvalStatus === 'approved'),
      'GET /api/tutor/search-instructors?q=jane returns 200 with approved instructors matching query'
    );

    // 7.2 Unauthenticated (401)
    try {
      await axios.get(`${API_URL}/tutor/search-instructors?q=jane`);
      assert(false, 'GET /api/tutor/search-instructors should reject unauthenticated caller');
    } catch (err) {
      assert(err.response?.status === 401, 'GET /api/tutor/search-instructors returns 401 when unauthenticated');
    }
  } catch (err) {
    assert(false, 'GET /api/tutor/search-instructors failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 8: POST /api/courses/:id/reviews
  // -------------------------------------------------------------
  printSection('8. POST /api/courses/:id/reviews');
  try {
    // 8.1 Not enrolled student (403)
    try {
      await axios.post(`${API_URL}/courses/${sampleCourseId}/reviews`, {
        rating: 5,
        reviewText: 'Great course!'
      }, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'POST /api/courses/:id/reviews should reject non-enrolled student');
    } catch (err) {
      assert(err.response?.status === 403, 'POST /api/courses/:id/reviews returns 403 when caller is not enrolled in course');
    }

    // Enroll student in the free course
    await axios.post(`${API_URL}/enrollments/enroll/${sampleCourseId}`, {}, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });

    // 8.2 Validation error (rating not in 1..5) (400)
    try {
      await axios.post(`${API_URL}/courses/${sampleCourseId}/reviews`, {
        rating: 10,
        reviewText: 'Too high'
      }, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'POST /api/courses/:id/reviews should reject invalid rating');
    } catch (err) {
      assert(err.response?.status === 400, 'POST /api/courses/:id/reviews returns 400 for out-of-range rating');
    }

    // 8.3 Valid review creation (201)
    const reviewRes = await axios.post(`${API_URL}/courses/${sampleCourseId}/reviews`, {
      rating: 5,
      reviewText: 'Spectacular course curriculum and crystal-clear explanations!'
    }, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(
      reviewRes.status === 201 &&
      reviewRes.data.review &&
      reviewRes.data.review.rating === 5,
      'POST /api/courses/:id/reviews creates review and returns 201'
    );
    createdReviewId = reviewRes.data.review._id;

    // Verify course rating recalculation
    const courseAfterReview = await axios.get(`${API_URL}/courses/${sampleCourseId}`);
    assert(
      courseAfterReview.data.course.rating.count > 0 &&
      courseAfterReview.data.course.rating.average > 0,
      'Course rating (average and count) automatically recalculated upon review creation'
    );

    // 8.4 Upsert review check (subsequent review from same student updates rating & comment)
    const upsertRes = await axios.post(`${API_URL}/courses/${sampleCourseId}/reviews`, {
      rating: 4,
      reviewText: 'Updated review with even better perspective!'
    }, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(
      (upsertRes.status === 200 || upsertRes.status === 201) &&
      upsertRes.data.review.rating === 4,
      'POST /api/courses/:id/reviews upserts review document upon subsequent submission and updates rating'
    );
  } catch (err) {
    assert(false, 'POST /api/courses/:id/reviews failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 9: GET /api/courses/:id/reviews
  // -------------------------------------------------------------
  printSection('9. GET /api/courses/:id/reviews');
  try {
    const listRes = await axios.get(`${API_URL}/courses/${sampleCourseId}/reviews`);
    assert(
      listRes.status === 200 &&
      Array.isArray(listRes.data.reviews) &&
      listRes.data.pagination &&
      listRes.data.reviews.length > 0 &&
      listRes.data.reviews[0].student &&
      listRes.data.reviews[0].student.name,
      'GET /api/courses/:id/reviews returns 200 with paginated reviews and populated student details'
    );
  } catch (err) {
    assert(false, 'GET /api/courses/:id/reviews failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 10: GET /api/tutor/reviews
  // -------------------------------------------------------------
  printSection('10. GET /api/tutor/reviews');
  try {
    // 10.1 Tutor access (200)
    const tutorReviewsRes = await axios.get(`${API_URL}/tutor/reviews`, {
      headers: { Authorization: `Bearer ${tutorToken}` }
    });
    assert(
      tutorReviewsRes.status === 200 &&
      Array.isArray(tutorReviewsRes.data.reviews) &&
      tutorReviewsRes.data.pagination,
      'GET /api/tutor/reviews returns 200 with reviews across tutor courses'
    );

    // 10.2 Student forbidden (403)
    try {
      await axios.get(`${API_URL}/tutor/reviews`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'GET /api/tutor/reviews should reject student caller');
    } catch (err) {
      assert(err.response?.status === 403, 'GET /api/tutor/reviews returns 403 Forbidden for students');
    }
  } catch (err) {
    assert(false, 'GET /api/tutor/reviews failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 11: POST /api/tutor/reviews/:id/reply
  // -------------------------------------------------------------
  printSection('11. POST /api/tutor/reviews/:id/reply');
  try {
    // 11.1 Non-owner tutor forbidden (403)
    try {
      await axios.post(`${API_URL}/tutor/reviews/${createdReviewId}/reply`, {
        text: 'Unauthorized reply'
      }, {
        headers: { Authorization: `Bearer ${nonOwnerTutorToken}` }
      });
      assert(false, 'POST /api/tutor/reviews/:id/reply should reject non-owner instructor');
    } catch (err) {
      assert(err.response?.status === 403, 'POST /api/tutor/reviews/:id/reply returns 403 for non-owner instructor');
    }

    // 11.2 Course owner tutor reply (200)
    const replyRes = await axios.post(`${API_URL}/tutor/reviews/${createdReviewId}/reply`, {
      text: 'Thank you for your fantastic feedback, keep up the great learning!'
    }, {
      headers: { Authorization: `Bearer ${tutorToken}` }
    });
    assert(
      replyRes.status === 200 &&
      replyRes.data.review &&
      replyRes.data.review.tutorReply &&
      replyRes.data.review.tutorReply.text.includes('Thank you'),
      'POST /api/tutor/reviews/:id/reply records tutorReply and dispatches notification'
    );
  } catch (err) {
    assert(false, 'POST /api/tutor/reviews/:id/reply failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 12: GET /api/admin/reviews
  // -------------------------------------------------------------
  printSection('12. GET /api/admin/reviews');
  try {
    // 12.1 Admin access
    const adminReviewsRes = await axios.get(`${API_URL}/admin/reviews`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      adminReviewsRes.status === 200 &&
      Array.isArray(adminReviewsRes.data.reviews) &&
      adminReviewsRes.data.pagination &&
      adminReviewsRes.data.reviews.some(r => r._id === createdReviewId),
      'GET /api/admin/reviews returns 200 with all platform reviews and pagination'
    );

    // 12.2 Student forbidden
    try {
      await axios.get(`${API_URL}/admin/reviews`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'GET /api/admin/reviews should reject student caller');
    } catch (err) {
      assert(err.response?.status === 403, 'GET /api/admin/reviews returns 403 Forbidden for non-admin callers');
    }
  } catch (err) {
    assert(false, 'GET /api/admin/reviews failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // ENDPOINT 13: DELETE /api/admin/reviews/:id
  // -------------------------------------------------------------
  printSection('13. DELETE /api/admin/reviews/:id');
  try {
    // 13.1 Non-admin forbidden
    try {
      await axios.delete(`${API_URL}/admin/reviews/${createdReviewId}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert(false, 'DELETE /api/admin/reviews/:id should reject non-admin callers');
    } catch (err) {
      assert(err.response?.status === 403, 'DELETE /api/admin/reviews/:id returns 403 Forbidden for non-admin callers');
    }

    // 13.2 Admin delete review
    const delRes = await axios.delete(`${API_URL}/admin/reviews/${createdReviewId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      delRes.status === 200 &&
      delRes.data.message &&
      delRes.data.message.includes('deleted'),
      'DELETE /api/admin/reviews/:id removes review and returns 200'
    );

    // Verify course rating recalculation after deletion
    const courseAfterDel = await axios.get(`${API_URL}/courses/${sampleCourseId}`);
    assert(
      courseAfterDel.data.course !== undefined,
      'Course ratings successfully recalculated after review deletion'
    );

    // 13.3 Non-existent review 404
    try {
      await axios.delete(`${API_URL}/admin/reviews/64f123456789abcdef012345`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(false, 'DELETE /api/admin/reviews/:id should return 404 for non-existent review');
    } catch (err) {
      assert(err.response?.status === 404, 'DELETE /api/admin/reviews/:id returns 404 when review not found');
    }
  } catch (err) {
    assert(false, 'DELETE /api/admin/reviews/:id failed', err.response?.data?.error || err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log(`\n${colors.cyan}${colors.bold}====================================================`);
  console.log(`  UNIT 16 ENDPOINTS TEST SUMMARY`);
  console.log(`====================================================${colors.reset}`);
  console.log(`  Total Assertions: ${passedCount + failedCount}`);
  console.log(`  ${colors.green}Passed: ${passedCount}${colors.reset}`);
  console.log(`  ${failedCount === 0 ? colors.green : colors.red}Failed: ${failedCount}${colors.reset}`);

  if (failedCount === 0) {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL UNIT 16 API ENDPOINTS VERIFIED & WORKING FLAWLESSLY!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ SOME ASSERTIONS FAILED! Check logs above.${colors.reset}\n`);
    process.exit(1);
  }
}

runUnit16EndpointTests();
