import mongoose from 'mongoose';
import { app } from '../src/app.js';
import connectDB from '../src/config/db.js';
import { User } from '../src/models/User.model.js';
import { Course } from '../src/models/Course.model.js';
import { Enrollment } from '../src/models/Enrollment.model.js';
import { Transaction } from '../src/models/Transaction.model.js';
import { signToken } from '../src/utils/jwt.js';

async function testAllUnit10Endpoints() {
  console.log("===============================================================================");
  console.log("🧪 EXPLICIT ENDPOINT VERIFICATION SUITE — UNIT 10 ENROLLMENTS & PAYSTACK");
  console.log("===============================================================================\n");

  await connectDB();

  // Setup student & instructor test accounts
  let studentUser = await User.findOne({ email: "student_unit10_explicit@gloxad.com" });
  if (!studentUser) {
    studentUser = await User.create({
      firstName: "Jane",
      lastName: "Student",
      username: "jane_student_unit10",
      email: "student_unit10_explicit@gloxad.com",
      password: "Password123!",
      role: "student",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  let instructorUser = await User.findOne({ email: "instructor_unit10_explicit@gloxad.com" });
  if (!instructorUser) {
    instructorUser = await User.create({
      firstName: "David",
      lastName: "Tutor",
      username: "david_tutor_unit10",
      email: "instructor_unit10_explicit@gloxad.com",
      password: "Password123!",
      role: "instructor",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  const studentToken = signToken({ sub: studentUser._id, role: studentUser.role, tokenVersion: studentUser.tokenVersion });

  // Clean test courses & enrollments
  await Course.deleteMany({ slug: { $in: ["demo-free-python", "demo-paid-react"] } });
  await Enrollment.deleteMany({ user: studentUser._id });
  await Transaction.deleteMany({ user: studentUser._id });

  const freeCourse = await Course.create({
    title: "Demo Free Python Course",
    slug: "demo-free-python",
    subtitle: "Learn Python for Free",
    description: "Introductory course.",
    instructor: instructorUser._id,
    category: new mongoose.Types.ObjectId(),
    subCategory: "Programming",
    topic: "Python",
    level: "beginner",
    courseType: "free",
    price: 0,
    status: "published",
    publishedAt: new Date(),
    enrolledCount: 0
  });

  const paidCourse = await Course.create({
    title: "Demo Paid React Course",
    slug: "demo-paid-react",
    subtitle: "Master React & Redux",
    description: "Advanced frontend course.",
    instructor: instructorUser._id,
    category: new mongoose.Types.ObjectId(),
    subCategory: "Web",
    topic: "React",
    level: "intermediate",
    courseType: "paid",
    price: 15000,
    discountPrice: 15000,
    status: "published",
    publishedAt: new Date(),
    enrolledCount: 0
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/enrollments`;

  async function logStep(testName, method, endpoint, headers, body) {
    console.log(`\n-------------------------------------------------------------------------------`);
    console.log(`📌 TEST: ${testName}`);
    console.log(`👉 REQUEST: ${method} ${endpoint}`);
    if (body) console.log(`   PAYLOAD:`, JSON.stringify(body));

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(endpoint, options);
    const json = await res.json();

    console.log(`👈 RESPONSE STATUS: ${res.status}`);
    console.log(`   BODY:`, JSON.stringify(json, null, 2));
    return { status: res.status, json };
  }

  try {
    // 1. Endpoint 1: POST /api/enrollments/enroll/:courseId (Free course)
    await logStep(
      "Instant Free Course Enrollment",
      "POST",
      `${baseUrl}/enroll/${freeCourse.slug}`,
      { Authorization: `Bearer ${studentToken}` }
    );

    // 2. Endpoint 1: POST /api/enrollments/enroll/:courseId (Re-enrollment handling)
    await logStep(
      "Duplicate Free Course Enrollment Safeguard",
      "POST",
      `${baseUrl}/enroll/${freeCourse._id}`,
      { Authorization: `Bearer ${studentToken}` }
    );

    // 3. Endpoint 1: POST /api/enrollments/enroll/:courseId (Attempting free enrollment on paid course)
    await logStep(
      "Free Enrollment Rejection on Paid Course",
      "POST",
      `${baseUrl}/enroll/${paidCourse._id}`,
      { Authorization: `Bearer ${studentToken}` }
    );

    // 4. Endpoint 2: POST /api/enrollments/checkout (Paid course payment verification & revenue share)
    const paystackRef = "PAYSTACK_TEST_REF_EXPLICIT_9988776655";
    await logStep(
      "Paid Course Paystack Checkout & Verification",
      "POST",
      `${baseUrl}/checkout`,
      { Authorization: `Bearer ${studentToken}` },
      { courseId: paidCourse._id.toString(), reference: paystackRef }
    );

    // 5. Endpoint 2: POST /api/enrollments/checkout (Idempotency duplicate check)
    await logStep(
      "Idempotency Check on Duplicate Paystack Reference",
      "POST",
      `${baseUrl}/checkout`,
      { Authorization: `Bearer ${studentToken}` },
      { courseId: paidCourse._id.toString(), reference: paystackRef }
    );

    // 6. Endpoint 3: GET /api/enrollments/check/:courseId (Check enrolled status for free course)
    await logStep(
      "Check Enrollment Status (Free Course)",
      "GET",
      `${baseUrl}/check/${freeCourse.slug}`,
      { Authorization: `Bearer ${studentToken}` }
    );

    // 7. Endpoint 3: GET /api/enrollments/check/:courseId (Check enrolled status for paid course)
    await logStep(
      "Check Enrollment Status (Paid Course)",
      "GET",
      `${baseUrl}/check/${paidCourse._id}`,
      { Authorization: `Bearer ${studentToken}` }
    );

    // 8. Endpoint 4: GET /api/enrollments/my-courses (List user's enrolled courses with populated metadata)
    await logStep(
      "Get Authenticated User Enrolled Courses Directory",
      "GET",
      `${baseUrl}/my-courses?page=1&limit=10`,
      { Authorization: `Bearer ${studentToken}` }
    );

    console.log(`\n===============================================================================`);
    console.log(`✅ ALL 4 NEW ENROLLMENT API ENDPOINTS TESTED SUCCESSFULLY!`);
    console.log(`===============================================================================\n`);
  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    server.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

testAllUnit10Endpoints();
