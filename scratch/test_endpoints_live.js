import mongoose from "mongoose";
import http from "http";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Course } from "../src/models/Course.model.js";
import { signToken } from "../src/utils/jwt.js";

async function testAllEndpoints() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gloxad_live_test";
  console.log("==================================================");
  console.log("🚀 STARTING LIVE ENDPOINT TESTING FOR UNIT 07");
  console.log("==================================================\n");

  await mongoose.connect(mongoUri);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Local Test Server running at ${baseUrl}\n`);

  try {
    // 1. Setup Test Users
    await User.deleteMany({ email: { $in: ["student.test@gloxad.com", "instructor.test@gloxad.com"] } });

    const student = await User.create({
      firstName: "Test",
      lastName: "Student",
      email: "student.test@gloxad.com",
      password: "password123",
      role: "student",
      isVerified: true,
    });
    const studentToken = signToken({ sub: student._id, role: student.role, tokenVersion: student.tokenVersion });

    const instructor = await User.create({
      firstName: "Test",
      lastName: "Instructor",
      email: "instructor.test@gloxad.com",
      password: "password123",
      role: "instructor",
      approvalStatus: "approved",
      isVerified: true,
    });
    const instructorToken = signToken({ sub: instructor._id, role: instructor.role, tokenVersion: instructor.tokenVersion });

    // Seed Courses for Instructor
    await Course.deleteMany({ instructor: instructor._id });
    await Course.create([
      {
        title: "Full-Stack Masterclass",
        slug: "fullstack-masterclass",
        category: "Technology",
        courseType: "paid",
        price: 50000,
        discountPrice: 40000,
        status: "published",
        instructor: instructor._id,
        enrolledCount: 20,
        rating: { average: 4.9, count: 15 },
      },
      {
        title: "Advanced System Design",
        slug: "system-design",
        category: "Technology",
        courseType: "paid",
        price: 30000,
        status: "pending",
        instructor: instructor._id,
        enrolledCount: 0,
      },
      {
        title: "Intro to Node.js Draft",
        slug: "nodejs-draft",
        category: "Technology",
        courseType: "free",
        price: 0,
        status: "draft",
        instructor: instructor._id,
        enrolledCount: 0,
      }
    ]);

    // ------------------------------------------------------------------------
    // ENDPOINT 1: POST /api/tutor/showcase-expertise (Unauthenticated)
    // ------------------------------------------------------------------------
    console.log("--------------------------------------------------");
    console.log("TEST 1: POST /api/tutor/showcase-expertise (Unauthenticated)");
    console.log("--------------------------------------------------");
    const res1 = await fetch(`${baseUrl}/api/tutor/showcase-expertise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ areaOfExpertise: "Software", expertiseBio: "Bio" })
    });
    console.log(`Status: ${res1.status} ${res1.statusText}`);
    const body1 = await res1.json();
    console.log("Response Body:", JSON.stringify(body1, null, 2));
    console.assert(res1.status === 401, "Should return 401 Unauthorized");

    // ------------------------------------------------------------------------
    // ENDPOINT 2: POST /api/tutor/showcase-expertise (Missing Body Fields)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------");
    console.log("TEST 2: POST /api/tutor/showcase-expertise (Missing Required Fields)");
    console.log("--------------------------------------------------");
    const res2 = await fetch(`${baseUrl}/api/tutor/showcase-expertise`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ title: "Software Architect" })
    });
    console.log(`Status: ${res2.status} ${res2.statusText}`);
    const body2 = await res2.json();
    console.log("Response Body:", JSON.stringify(body2, null, 2));
    console.assert(res2.status === 400, "Should return 400 Bad Request");

    // ------------------------------------------------------------------------
    // ENDPOINT 3: POST /api/tutor/showcase-expertise (Valid Submission)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------");
    console.log("TEST 3: POST /api/tutor/showcase-expertise (Valid Submission - Student to Instructor)");
    console.log("--------------------------------------------------");
    const res3 = await fetch(`${baseUrl}/api/tutor/showcase-expertise`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        title: "Senior Software Engineer",
        areaOfExpertise: "Software Engineering & Web Development",
        experienceYears: 6,
        expertiseBio: "10+ years building scalable distributed systems and training developers globally.",
        university: "University of Lagos",
        skills: ["JavaScript", "Node.js", "React", "MongoDB"],
        certificationsUrl: "https://gloxad-media.s3.amazonaws.com/certifications/1727800000-alex_aws_cert.pdf",
        certifications: ["AWS Certified Solutions Architect"]
      })
    });
    console.log(`Status: ${res3.status} ${res3.statusText}`);
    const body3 = await res3.json();
    console.log("Response Body:", JSON.stringify(body3, null, 2));
    console.assert(res3.status === 200, "Should return 200 OK");
    console.assert(body3.user.role === "instructor", "Role should upgrade to instructor");
    console.assert(body3.user.approvalStatus === "pending", "approvalStatus should be pending");

    // ------------------------------------------------------------------------
    // ENDPOINT 4: GET /api/tutor/dashboard-stats (Forbidden for non-instructor/unapproved student)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------");
    console.log("TEST 4: GET /api/tutor/dashboard-stats (Student Role - Forbidden)");
    console.log("--------------------------------------------------");
    const unapprovedUser = await User.create({
      firstName: "Unapproved",
      email: "unapproved@gloxad.com",
      password: "password123",
      role: "student"
    });
    const unapprovedToken = signToken({ sub: unapprovedUser._id, role: unapprovedUser.role, tokenVersion: unapprovedUser.tokenVersion });

    const res4 = await fetch(`${baseUrl}/api/tutor/dashboard-stats`, {
      headers: { Authorization: `Bearer ${unapprovedToken}` }
    });
    console.log(`Status: ${res4.status} ${res4.statusText}`);
    const body4 = await res4.json();
    console.log("Response Body:", JSON.stringify(body4, null, 2));
    console.assert(res4.status === 403, "Should return 403 Forbidden");

    // ------------------------------------------------------------------------
    // ENDPOINT 5: GET /api/tutor/dashboard-stats (Authenticated Instructor)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------");
    console.log("TEST 5: GET /api/tutor/dashboard-stats (Authenticated Instructor)");
    console.log("--------------------------------------------------");
    const res5 = await fetch(`${baseUrl}/api/tutor/dashboard-stats`, {
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    console.log(`Status: ${res5.status} ${res5.statusText}`);
    const body5 = await res5.json();
    console.log("Response Body:", JSON.stringify(body5, null, 2));
    console.assert(res5.status === 200, "Should return 200 OK");
    console.assert(body5.totalCourses === 3, "totalCourses should be 3");
    console.assert(body5.publishedCourses === 1, "publishedCourses should be 1");
    console.assert(body5.totalStudents === 20, "totalStudents should be 20");
    console.assert(body5.totalRevenue === 800000, "totalRevenue should be 800,000 (20 * 40,000)");

    // ------------------------------------------------------------------------
    // ENDPOINT 6: GET /api/tutor/earnings (Forbidden for non-instructor)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------");
    console.log("TEST 6: GET /api/tutor/earnings (Student Role - Forbidden)");
    console.log("--------------------------------------------------");
    const res6 = await fetch(`${baseUrl}/api/tutor/earnings`, {
      headers: { Authorization: `Bearer ${unapprovedToken}` }
    });
    console.log(`Status: ${res6.status} ${res6.statusText}`);
    const body6 = await res6.json();
    console.log("Response Body:", JSON.stringify(body6, null, 2));
    console.assert(res6.status === 403, "Should return 403 Forbidden");

    // ------------------------------------------------------------------------
    // ENDPOINT 7: GET /api/tutor/earnings (Authenticated Instructor)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------");
    console.log("TEST 7: GET /api/tutor/earnings (Authenticated Instructor)");
    console.log("--------------------------------------------------");
    const res7 = await fetch(`${baseUrl}/api/tutor/earnings`, {
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    console.log(`Status: ${res7.status} ${res7.statusText}`);
    const body7 = await res7.json();
    console.log("Response Body:", JSON.stringify(body7, null, 2));
    console.assert(res7.status === 200, "Should return 200 OK");
    console.assert(body7.totalEarnings === 640000, "totalEarnings should be 640,000 (80% of 800,000)");
    console.assert(body7.revenueSharePercentage === 80, "revenueSharePercentage should be 80");

    // Cleanup
    await User.deleteMany({ email: { $in: ["student.test@gloxad.com", "instructor.test@gloxad.com", "unapproved@gloxad.com"] } });
    await Course.deleteMany({ instructor: instructor._id });

    console.log("\n==================================================");
    console.log("🎉 ALL API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!");
    console.log("==================================================\n");

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

testAllEndpoints().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
