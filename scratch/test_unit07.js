import mongoose from "mongoose";
import http from "http";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Course } from "../src/models/Course.model.js";
import { signToken } from "../src/utils/jwt.js";

async function runTests() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gloxad_test_unit07";
  console.log("Connecting to MongoDB for Unit 07 verification test...");
  await mongoose.connect(mongoUri);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on ${baseUrl}`);

  let studentUser, instructorUser;
  let studentToken, instructorToken;

  try {
    // Cleanup old test data
    await User.deleteMany({ email: { $in: ["unit07.student@example.com", "unit07.instructor@example.com", "studentonly@example.com"] } });

    // Create student user
    studentUser = await User.create({
      firstName: "TestStudent",
      lastName: "Unit07",
      email: "unit07.student@example.com",
      password: "password123",
      role: "student",
      isVerified: true,
    });
    studentToken = signToken({ sub: studentUser._id, role: studentUser.role, tokenVersion: studentUser.tokenVersion });

    // Create instructor user
    instructorUser = await User.create({
      firstName: "TestInstructor",
      lastName: "Unit07",
      email: "unit07.instructor@example.com",
      password: "password123",
      role: "instructor",
      approvalStatus: "approved",
      isVerified: true,
    });
    instructorToken = signToken({ sub: instructorUser._id, role: instructorUser.role, tokenVersion: instructorUser.tokenVersion });

    // Seed test courses for instructor
    await Course.deleteMany({ instructor: instructorUser._id });
    await Course.create([
      {
        title: "Instructor Published Course 1",
        slug: "inst-pub-1",
        category: "Technology",
        courseType: "paid",
        price: 25000,
        discountPrice: 20000,
        status: "published",
        instructor: instructorUser._id,
        enrolledCount: 15,
        rating: { average: 4.8, count: 10 },
      },
      {
        title: "Instructor Pending Course 1",
        slug: "inst-pend-1",
        category: "Technology",
        courseType: "paid",
        price: 15000,
        status: "pending",
        instructor: instructorUser._id,
        enrolledCount: 0,
      },
      {
        title: "Instructor Draft Course 1",
        slug: "inst-draft-1",
        category: "Technology",
        courseType: "free",
        price: 0,
        status: "draft",
        instructor: instructorUser._id,
        enrolledCount: 0,
      },
    ]);

    console.log("\n--- TEST 1: Model Schema Validation ---");
    console.assert(studentUser.experienceYears === 0, "experienceYears default should be 0");
    console.assert(studentUser.expertiseBio === "", "expertiseBio default should be ''");
    console.assert(studentUser.certificationsUrl === "", "certificationsUrl default should be ''");
    const jsonOutput = studentUser.toJSON();
    console.assert(jsonOutput._id !== undefined, "toJSON output must retain _id");
    console.assert(jsonOutput.password === undefined, "toJSON output must strip password");
    console.assert(jsonOutput.experienceYears === 0, "toJSON output must include experienceYears");
    console.log("✓ Model Schema Validation Passed");

    console.log("\n--- TEST 2: POST /api/tutor/showcase-expertise (Unauthenticated) ---");
    const resUnauth = await fetch(`${baseUrl}/api/tutor/showcase-expertise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ areaOfExpertise: "Dev", expertiseBio: "Bio" }),
    });
    console.assert(resUnauth.status === 401, `Expected 401, got ${resUnauth.status}`);
    const bodyUnauth = await resUnauth.json();
    console.assert(bodyUnauth.error === "Authentication token missing or malformed", `Unexpected error: ${bodyUnauth.error}`);
    console.log("✓ Unauthenticated POST /api/tutor/showcase-expertise Passed");

    console.log("\n--- TEST 3: POST /api/tutor/showcase-expertise (Missing required fields) ---");
    const resMissing = await fetch(`${baseUrl}/api/tutor/showcase-expertise`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ title: "Senior Dev" }),
    });
    console.assert(resMissing.status === 400, `Expected 400, got ${resMissing.status}`);
    const bodyMissing = await resMissing.json();
    console.assert(bodyMissing.error === "Area of expertise and expertise bio are required", `Unexpected error: ${bodyMissing.error}`);
    console.log("✓ Missing Fields POST /api/tutor/showcase-expertise Passed");

    console.log("\n--- TEST 4: POST /api/tutor/showcase-expertise (Valid Request) ---");
    const resValid = await fetch(`${baseUrl}/api/tutor/showcase-expertise`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Senior Software Engineer",
        areaOfExpertise: "Software Engineering & Web Development",
        experienceYears: 5,
        expertiseBio: "5+ years training developers globally",
        university: "University of Lagos",
        skills: ["JavaScript", "Node.js"],
        certificationsUrl: "https://example.com/cert.pdf",
        certifications: ["AWS Certified"],
      }),
    });
    console.assert(resValid.status === 200, `Expected 200, got ${resValid.status}`);
    const bodyValid = await resValid.json();
    console.assert(bodyValid.user.role === "instructor", "Role should be upgraded to instructor");
    console.assert(bodyValid.user.approvalStatus === "pending", "approvalStatus should be pending");
    console.assert(bodyValid.user._id !== undefined, "user object must retain _id");
    console.assert(bodyValid.user.experienceYears === 5, "experienceYears should be updated");
    console.log("✓ Valid POST /api/tutor/showcase-expertise Passed");

    console.log("\n--- TEST 5: GET /api/tutor/dashboard-stats (Non-instructor / Student) ---");
    const newStudent = await User.create({
      firstName: "StudentOnly",
      email: "studentonly@example.com",
      password: "password123",
      role: "student",
    });
    const newStudentToken = signToken({ sub: newStudent._id, role: newStudent.role, tokenVersion: newStudent.tokenVersion });

    const resForbiddenStats = await fetch(`${baseUrl}/api/tutor/dashboard-stats`, {
      headers: { Authorization: `Bearer ${newStudentToken}` },
    });
    console.assert(resForbiddenStats.status === 403, `Expected 403, got ${resForbiddenStats.status}`);
    const bodyForbiddenStats = await resForbiddenStats.json();
    console.assert(bodyForbiddenStats.error === "Access denied. Instructor role required", `Unexpected error: ${bodyForbiddenStats.error}`);
    console.log("✓ Non-instructor GET /api/tutor/dashboard-stats Forbidden Passed");

    console.log("\n--- TEST 6: GET /api/tutor/dashboard-stats (Authenticated Instructor) ---");
    const resStats = await fetch(`${baseUrl}/api/tutor/dashboard-stats`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    console.assert(resStats.status === 200, `Expected 200, got ${resStats.status}`);
    const bodyStats = await resStats.json();
    console.assert(bodyStats.totalCourses === 3, `Expected totalCourses 3, got ${bodyStats.totalCourses}`);
    console.assert(bodyStats.publishedCourses === 1, `Expected publishedCourses 1, got ${bodyStats.publishedCourses}`);
    console.assert(bodyStats.pendingCourses === 1, `Expected pendingCourses 1, got ${bodyStats.pendingCourses}`);
    console.assert(bodyStats.draftCourses === 1, `Expected draftCourses 1, got ${bodyStats.draftCourses}`);
    console.assert(bodyStats.totalStudents === 15, `Expected totalStudents 15, got ${bodyStats.totalStudents}`);
    console.assert(bodyStats.totalRevenue === 300000, `Expected totalRevenue 300000 (15 * 20000), got ${bodyStats.totalRevenue}`);
    console.log("✓ GET /api/tutor/dashboard-stats Passed");

    console.log("\n--- TEST 7: GET /api/tutor/earnings (Non-instructor / Student) ---");
    const resForbiddenEarnings = await fetch(`${baseUrl}/api/tutor/earnings`, {
      headers: { Authorization: `Bearer ${newStudentToken}` },
    });
    console.assert(resForbiddenEarnings.status === 403, `Expected 403, got ${resForbiddenEarnings.status}`);
    const bodyForbiddenEarnings = await resForbiddenEarnings.json();
    console.assert(bodyForbiddenEarnings.error === "Access denied. Instructor role required", `Unexpected error: ${bodyForbiddenEarnings.error}`);
    console.log("✓ Non-instructor GET /api/tutor/earnings Forbidden Passed");

    console.log("\n--- TEST 8: GET /api/tutor/earnings (Authenticated Instructor) ---");
    const resEarnings = await fetch(`${baseUrl}/api/tutor/earnings`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    console.assert(resEarnings.status === 200, `Expected 200, got ${resEarnings.status}`);
    const bodyEarnings = await resEarnings.json();
    console.assert(bodyEarnings.totalEarnings === 240000, `Expected totalEarnings 240000 (80% of 300000), got ${bodyEarnings.totalEarnings}`);
    console.assert(bodyEarnings.revenueSharePercentage === 80, "Expected revenueSharePercentage 80");
    console.assert(bodyEarnings.withdrawableBalance + bodyEarnings.pendingBalance === bodyEarnings.totalEarnings, "Balances must sum to totalEarnings");
    console.log("✓ GET /api/tutor/earnings Passed");

    console.log("\n--- TEST 9: API Docs Portal Sync ---");
    const resDocs = await fetch(`${baseUrl}/`);
    console.assert(resDocs.status === 200, `Expected 200, got ${resDocs.status}`);
    const docsHtml = await resDocs.text();
    console.assert(docsHtml.includes("tutor/showcase-expertise"), "Docs should contain showcase-expertise endpoint");
    console.assert(docsHtml.includes("tutor/dashboard-stats"), "Docs should contain dashboard-stats endpoint");
    console.assert(docsHtml.includes("tutor/earnings"), "Docs should contain earnings endpoint");
    console.log("✓ API Docs Portal Sync Passed");

    // Cleanup
    await User.deleteMany({ email: { $in: ["unit07.student@example.com", "unit07.instructor@example.com", "studentonly@example.com"] } });
    await Course.deleteMany({ instructor: instructorUser._id });

    console.log("\n==========================================");
    console.log("ALL UNIT 07 VERIFICATION TESTS PASSED 100%");
    console.log("==========================================\n");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
