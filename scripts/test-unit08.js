import mongoose from "mongoose";
import http from "http";
import { app } from "../src/app.js";
import connectDB from "../src/config/db.js";
import { User } from "../src/models/User.model.js";
import { Course } from "../src/models/Course.model.js";
import { Appeal } from "../src/models/Appeal.model.js";
import { signToken } from "../src/utils/jwt.js";

async function makeRequest(server, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: "127.0.0.1",
      port: address.port,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("🚀 Initializing Unit 08 Automated Verification Suite...\n");

  await connectDB();

  // Create test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    // 1. Setup mock users
    let instructorA = await User.findOne({ email: "instructorA_unit08@gloxad.com" });
    if (!instructorA) {
      instructorA = await User.create({
        firstName: "Instructor",
        lastName: "Alpha",
        username: "instructorA_unit08",
        email: "instructorA_unit08@gloxad.com",
        password: "Password123!",
        role: "instructor",
        isEmailVerified: true,
        approvalStatus: "approved"
      });
    }

    let instructorB = await User.findOne({ email: "instructorB_unit08@gloxad.com" });
    if (!instructorB) {
      instructorB = await User.create({
        firstName: "Instructor",
        lastName: "Beta",
        username: "instructorB_unit08",
        email: "instructorB_unit08@gloxad.com",
        password: "Password123!",
        role: "instructor",
        isEmailVerified: true,
        approvalStatus: "approved"
      });
    }

    let student = await User.findOne({ email: "student_unit08@gloxad.com" });
    if (!student) {
      student = await User.create({
        firstName: "Student",
        lastName: "Charlie",
        username: "student_unit08",
        email: "student_unit08@gloxad.com",
        password: "Password123!",
        role: "student",
        isEmailVerified: true,
        approvalStatus: "approved"
      });
    }

    const tokenA = signToken({ sub: instructorA._id, role: instructorA.role, tokenVersion: instructorA.tokenVersion });
    const tokenB = signToken({ sub: instructorB._id, role: instructorB.role, tokenVersion: instructorB.tokenVersion });
    const tokenStudent = signToken({ sub: student._id, role: student.role, tokenVersion: student.tokenVersion });

    // Cleanup previous test courses and appeals
    await Course.deleteMany({ title: { $regex: /unit08/i } });
    await Appeal.deleteMany({ instructorId: { $in: [instructorA._id, instructorB._id] } });

    console.log("--- TEST 1: DRAFT COURSE CREATION (STEP 1) ---");
    // Missing title
    let res = await makeRequest(server, "POST", "/api/tutor/courses", { Authorization: `Bearer ${tokenA}` }, { category: "Development", courseType: "paid" });
    console.log("Draft Creation (Missing Title) Status:", res.status, res.body);
    if (res.status !== 400 || res.body.error !== "Title, category, and course type are required") {
      throw new Error("Failed validation check for missing title in step 1 creation");
    }

    // Role check (Student attempt)
    res = await makeRequest(server, "POST", "/api/tutor/courses", { Authorization: `Bearer ${tokenStudent}` }, { title: "Unit08 Student Attempt", category: "Development", courseType: "paid" });
    console.log("Draft Creation (Student Role) Status:", res.status, res.body);
    if (res.status !== 403 || res.body.error !== "Access denied. Instructor role required") {
      throw new Error("Failed role check for non-instructor creating draft course");
    }

    // Valid creation
    res = await makeRequest(server, "POST", "/api/tutor/courses", { Authorization: `Bearer ${tokenA}` }, {
      title: "Unit08 Master Full-Stack Web Development",
      subtitle: "Learn MERN stack",
      category: "Development & Engineering",
      courseType: "paid",
      price: 25000
    });
    console.log("Draft Creation (Valid) Status:", res.status, res.body.course?.title, "Slug:", res.body.course?.slug, "Status:", res.body.course?.status);
    if (res.status !== 201 || !res.body.course || res.body.course.status !== "draft" || res.body.course.slug !== "unit08-master-full-stack-web-development") {
      throw new Error("Failed valid step 1 draft creation");
    }

    const courseId = res.body.course._id;

    console.log("\n--- TEST 2: INCREMENTAL DRAFT UPDATES (STEPS 2-4) ---");
    const updatePayload = {
      thumbnail: "https://gloxad-media.s3.amazonaws.com/courses/thumbnails/unit08.jpg",
      trailerVideoUrl: "https://gloxad-media.s3.amazonaws.com/courses/trailers/unit08.mp4",
      description: "Detailed description for Unit08 Full-Stack Web Development course with at least 20 characters.",
      skills: ["React", "Node.js", "MongoDB"],
      targetAudience: ["Web Developers"],
      requirements: ["Basic HTML"],
      modules: [
        {
          title: "Module 1: Introduction",
          lessons: [
            {
              title: "Lesson 1: Hello World",
              duration: "10:00",
              isFreePreview: true,
              videoUrl: "https://gloxad-media.s3.amazonaws.com/courses/videos/lesson1.mp4"
            }
          ],
          quizzes: [
            {
              title: "Quiz 1",
              passingScore: 80,
              questions: [
                {
                  questionText: "What is React?",
                  options: ["Library", "Framework", "Database", "OS"],
                  correctOptionIndex: 0
                }
              ]
            }
          ]
        }
      ],
      welcomeMessage: "Welcome to Unit08 course!",
      congratsMessage: "Congratulations on finishing Unit08!"
    };

    res = await makeRequest(server, "PUT", `/api/tutor/courses/${courseId}`, { Authorization: `Bearer ${tokenA}` }, updatePayload);
    console.log("Draft Update Status:", res.status, res.body.message);
    if (res.status !== 200 || !res.body.course || res.body.course.modules.length !== 1) {
      throw new Error("Failed incremental draft update");
    }

    console.log("\n--- TEST 3: UNSHIELDED INSTRUCTOR DRAFT PREVIEW ---");
    res = await makeRequest(server, "GET", `/api/tutor/courses/${courseId}`, { Authorization: `Bearer ${tokenA}` });
    console.log("Unshielded Preview Status:", res.status, "VideoUrl present:", !!res.body.course?.modules[0]?.lessons[0]?.videoUrl, "CorrectOptionIndex:", res.body.course?.modules[0]?.quizzes[0]?.questions[0]?.correctOptionIndex);
    if (res.status !== 200 || !res.body.course?.modules[0]?.lessons[0]?.videoUrl || res.body.course?.modules[0]?.quizzes[0]?.questions[0]?.correctOptionIndex !== 0) {
      throw new Error("Unshielded preview did not return videoUrl or correctOptionIndex for course owner");
    }

    console.log("\n--- TEST 4: RESOURCE OWNERSHIP PROTECTION ---");
    res = await makeRequest(server, "PUT", `/api/tutor/courses/${courseId}`, { Authorization: `Bearer ${tokenB}` }, { title: "Hacked Title" });
    console.log("Ownership Protection Update Status:", res.status, res.body);
    if (res.status !== 403 || res.body.error !== "You do not have permission to edit this course") {
      throw new Error("Failed ownership protection check on PUT draft course");
    }

    res = await makeRequest(server, "GET", `/api/tutor/courses/${courseId}`, { Authorization: `Bearer ${tokenB}` });
    console.log("Ownership Protection Get Status:", res.status, res.body);
    if (res.status !== 403 || res.body.error !== "You do not have permission to view this course draft") {
      throw new Error("Failed ownership protection check on GET draft preview");
    }

    console.log("\n--- TEST 5: STEP COMPLETENESS & REVIEW SUBMISSION (STEP 5) ---");
    // Create an incomplete draft first
    const incRes = await makeRequest(server, "POST", "/api/tutor/courses", { Authorization: `Bearer ${tokenA}` }, {
      title: "Unit08 Incomplete Course",
      category: "Development",
      courseType: "paid",
      price: 20000
    });
    const incCourseId = incRes.body.course._id;

    // Attempt submit incomplete course (no lessons/description)
    res = await makeRequest(server, "POST", `/api/tutor/courses/${incCourseId}/submit`, { Authorization: `Bearer ${tokenA}` });
    console.log("Submit Incomplete Course Status:", res.status, res.body);
    if (res.status !== 400 || !res.body.error.includes("Course incomplete")) {
      throw new Error("Failed validation check for incomplete course submission");
    }

    // Submit complete course
    res = await makeRequest(server, "POST", `/api/tutor/courses/${courseId}/submit`, { Authorization: `Bearer ${tokenA}` });
    console.log("Submit Complete Course Status:", res.status, res.body.message, "New Status:", res.body.course?.status);
    if (res.status !== 200 || res.body.course?.status !== "pending") {
      throw new Error("Failed complete course submission");
    }

    // Try editing a pending course
    res = await makeRequest(server, "PUT", `/api/tutor/courses/${courseId}`, { Authorization: `Bearer ${tokenA}` }, { title: "Edit Pending Course" });
    console.log("Edit Pending Course Status:", res.status, res.body);
    if (res.status !== 400 || res.body.error !== "Cannot edit a course that is currently pending review or published") {
      throw new Error("Failed restriction against editing pending course");
    }

    console.log("\n--- TEST 6: REJECTED COURSE APPEAL ---");
    // Attempt appeal on pending course (should fail)
    res = await makeRequest(server, "POST", `/api/tutor/courses/${courseId}/appeal`, { Authorization: `Bearer ${tokenA}` }, { message: "Please approve me!" });
    console.log("Appeal Non-Rejected Course Status:", res.status, res.body);
    if (res.status !== 400 || res.body.error !== "Appeals can only be submitted for rejected courses") {
      throw new Error("Failed restriction against appealing non-rejected course");
    }

    // Mark course as rejected directly in DB
    await Course.findByIdAndUpdate(courseId, { status: "rejected" });

    // Submit appeal with empty message
    res = await makeRequest(server, "POST", `/api/tutor/courses/${courseId}/appeal`, { Authorization: `Bearer ${tokenA}` }, { message: "" });
    console.log("Appeal Empty Message Status:", res.status, res.body);
    if (res.status !== 400 || res.body.error !== "Appeal message is required") {
      throw new Error("Failed validation for empty appeal message");
    }

    // Submit valid appeal
    res = await makeRequest(server, "POST", `/api/tutor/courses/${courseId}/appeal`, { Authorization: `Bearer ${tokenA}` }, { message: "I have updated the lesson videos as requested." });
    console.log("Appeal Submission Status:", res.status, res.body.message, "Appeal Status:", res.body.appeal?.status);
    if (res.status !== 201 || !res.body.appeal || res.body.appeal.status !== "pending" || res.body.appeal.message !== "I have updated the lesson videos as requested.") {
      throw new Error("Failed valid appeal creation");
    }

    console.log("\n--- TEST 7: INSTRUCTOR COURSES LIST ---");
    res = await makeRequest(server, "GET", "/api/tutor/courses", { Authorization: `Bearer ${tokenA}` });
    console.log("Get Instructor Courses Status:", res.status, "Count:", res.body.courses?.length);
    if (res.status !== 200 || !Array.isArray(res.body.courses) || res.body.courses.length < 2) {
      throw new Error("Failed retrieving instructor courses listing");
    }

    console.log("\n✅ ALL UNIT 08 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
