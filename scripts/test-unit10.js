import mongoose from 'mongoose';
import { app } from '../src/app.js';
import connectDB from '../src/config/db.js';
import { User } from '../src/models/User.model.js';
import { Course } from '../src/models/Course.model.js';
import { Enrollment } from '../src/models/Enrollment.model.js';
import { Transaction } from '../src/models/Transaction.model.js';
import { signToken } from '../src/utils/jwt.js';

async function runTests() {
  console.log("🚀 Initializing Unit 10 (Enrollments & Paystack Verification) Automated Verification Suite...\n");

  await connectDB();

  // 1. Setup mock test users
  let studentUser = await User.findOne({ email: "student_unit10@gloxad.com" });
  if (!studentUser) {
    studentUser = await User.create({
      firstName: "Test",
      lastName: "Student",
      username: "student_unit10",
      email: "student_unit10@gloxad.com",
      password: "Password123!",
      role: "student",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  let instructorUser = await User.findOne({ email: "instructor_unit10@gloxad.com" });
  if (!instructorUser) {
    instructorUser = await User.create({
      firstName: "Alex",
      lastName: "Instructor",
      username: "instructor_unit10",
      email: "instructor_unit10@gloxad.com",
      password: "Password123!",
      role: "instructor",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  const studentToken = signToken({ sub: studentUser._id, role: studentUser.role, tokenVersion: studentUser.tokenVersion });

  // 2. Setup mock free course and paid course
  await Course.deleteMany({ slug: { $in: ["unit-10-free-course", "unit-10-paid-course", "unit-10-draft-course"] } });
  await Enrollment.deleteMany({ user: studentUser._id });
  await Transaction.deleteMany({ user: studentUser._id });

  const freeCourse = await Course.create({
    title: "Unit 10 Free Course",
    slug: "unit-10-free-course",
    subtitle: "A free introductory course",
    description: "Learn zero-cost enrollment mechanics.",
    instructor: instructorUser._id,
    category: new mongoose.Types.ObjectId(),
    subCategory: "General",
    topic: "Web Development",
    level: "beginner",
    courseType: "free",
    price: 0,
    status: "published",
    publishedAt: new Date(),
    enrolledCount: 0
  });

  const paidCourse = await Course.create({
    title: "Unit 10 Paid Course",
    slug: "unit-10-paid-course",
    subtitle: "A comprehensive paid course",
    description: "Learn Paystack payment verification.",
    instructor: instructorUser._id,
    category: new mongoose.Types.ObjectId(),
    subCategory: "Advanced",
    topic: "Web Development",
    level: "advanced",
    courseType: "paid",
    price: 15000,
    discountPrice: 15000,
    status: "published",
    publishedAt: new Date(),
    enrolledCount: 0
  });

  const draftCourse = await Course.create({
    title: "Unit 10 Draft Course",
    slug: "unit-10-draft-course",
    subtitle: "Unpublished course",
    description: "Draft course state.",
    instructor: instructorUser._id,
    category: new mongoose.Types.ObjectId(),
    subCategory: "General",
    topic: "Web Development",
    level: "beginner",
    courseType: "free",
    price: 0,
    status: "draft"
  });

  // Mock server listener for testing routes
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/enrollments`;

  let passed = 0;
  let failed = 0;

  async function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    console.log("--- 1. Authentication Guards ---");
    const unauthRes = await fetch(`${baseUrl}/my-courses`);
    const unauthData = await unauthRes.json();
    await assert(unauthRes.status === 401 && unauthData.error === "Authentication token missing or malformed", "Unauthenticated request rejected with 401");

    console.log("\n--- 2. Free Course Enrollment ---");
    // Attempt free enrollment on paid course -> 400
    const paidEnrollRes = await fetch(`${baseUrl}/enroll/${paidCourse._id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const paidEnrollData = await paidEnrollRes.json();
    await assert(paidEnrollRes.status === 400 && paidEnrollData.error === "This course is a paid course. Please proceed to payment checkout.", "Free endpoint rejects paid course with 400");

    // Attempt free enrollment on draft course -> 400
    const draftEnrollRes = await fetch(`${baseUrl}/enroll/${draftCourse._id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const draftEnrollData = await draftEnrollRes.json();
    await assert(draftEnrollRes.status === 400 && draftEnrollData.error === "Cannot enroll in a course that is not published", "Free endpoint rejects draft course with 400");

    // Free enrollment on published free course -> 201
    const freeEnrollRes = await fetch(`${baseUrl}/enroll/${freeCourse.slug}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const freeEnrollData = await freeEnrollRes.json();
    await assert(freeEnrollRes.status === 201 && freeEnrollData.enrollment._id && freeEnrollData.message.includes("Enrolled successfully"), "Free course enrollment returns 201 with enrollment object");

    // Re-enrollment -> 200
    const reEnrollRes = await fetch(`${baseUrl}/enroll/${freeCourse._id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const reEnrollData = await reEnrollRes.json();
    await assert(reEnrollRes.status === 200 && reEnrollData.message.includes("Already enrolled"), "Re-enrollment returns 200 with existing enrollment");

    console.log("\n--- 3. Check Enrollment Status ---");
    const checkRes = await fetch(`${baseUrl}/check/${freeCourse.slug}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const checkData = await checkRes.json();
    await assert(checkRes.status === 200 && checkData.isEnrolled === true && checkData.enrollment._id, "Enrollment check returns isEnrolled: true");

    const checkNotRes = await fetch(`${baseUrl}/check/${paidCourse._id}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const checkNotData = await checkNotRes.json();
    await assert(checkNotRes.status === 200 && checkNotData.isEnrolled === false && checkNotData.enrollment === null, "Enrollment check returns isEnrolled: false for non-enrolled course");

    console.log("\n--- 4. Paid Course Checkout Verification ---");
    // Missing body fields -> 400
    const emptyCheckoutRes = await fetch(`${baseUrl}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({})
    });
    const emptyCheckoutData = await emptyCheckoutRes.json();
    await assert(emptyCheckoutRes.status === 400 && emptyCheckoutData.error === "courseId and reference are required", "Checkout rejects missing parameters with 400");

    const testReference = "PAYSTACK_TEST_REF_1029384756";

    // Execute checkout with simulated test reference
    const checkoutRes = await fetch(`${baseUrl}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ courseId: paidCourse._id.toString(), reference: testReference })
    });
    const checkoutData = await checkoutRes.json();
    await assert(
      checkoutRes.status === 201 &&
      checkoutData.enrollment._id &&
      checkoutData.transaction.reference === testReference &&
      checkoutData.transaction.amount === 15000 &&
      checkoutData.transaction.instructorShare === 10500 && // 70% of 15,000
      checkoutData.transaction.platformShare === 4500,     // 30% of 15,000
      "Paid checkout verifies Paystack reference, calculates 70/30 revenue share, and returns 201"
    );

    // Idempotency check: repeat same reference -> 200 OK with existing records
    const idempotencyRes = await fetch(`${baseUrl}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ courseId: paidCourse._id.toString(), reference: testReference })
    });
    const idempotencyData = await idempotencyRes.json();
    await assert(
      idempotencyRes.status === 200 &&
      idempotencyData.message === "Payment already verified and course unlocked" &&
      idempotencyData.transaction.reference === testReference,
      "Submitting duplicate payment reference returns existing transaction without double processing (Idempotency)"
    );

    console.log("\n--- 5. My Enrolled Courses Directory ---");
    const myCoursesRes = await fetch(`${baseUrl}/my-courses`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const myCoursesData = await myCoursesRes.json();
    await assert(
      myCoursesRes.status === 200 &&
      Array.isArray(myCoursesData.enrollments) &&
      myCoursesData.enrollments.length === 2 &&
      myCoursesData.pagination.total === 2,
      "My courses endpoint returns all active user enrollments with populated metadata and pagination"
    );

  } catch (err) {
    console.error("Critical test execution error:", err);
    failed++;
  } finally {
    server.close();
    await mongoose.connection.close();
    console.log(`\n========================================`);
    console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
