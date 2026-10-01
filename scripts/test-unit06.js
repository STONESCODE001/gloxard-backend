import mongoose from "mongoose";
import { app } from "../src/app.js";
import connectDB from "../src/config/db.js";
import { User } from "../src/models/User.model.js";
import { Course } from "../src/models/Course.model.js";
import { signToken } from "../src/utils/jwt.js";

async function runTests() {
  console.log("🚀 Initializing Unit 06 Automated API Verification Suite...\n");

  await connectDB();
  await Course.createIndexes();

  // 1. Setup mock users
  let studentUser = await User.findOne({ email: "student_unit06@gloxad.com" });
  if (!studentUser) {
    studentUser = await User.create({
      firstName: "Test",
      lastName: "Student",
      username: "student_unit06",
      email: "student_unit06@gloxad.com",
      password: "Password123!",
      role: "student",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  let instructorUser = await User.findOne({ email: "instructor_unit06@gloxad.com" });
  if (!instructorUser) {
    instructorUser = await User.create({
      firstName: "Test",
      lastName: "Instructor",
      username: "instructor_unit06",
      email: "instructor_unit06@gloxad.com",
      password: "Password123!",
      role: "instructor",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  let adminUser = await User.findOne({ email: "admin_unit06@gloxad.com" });
  if (!adminUser) {
    adminUser = await User.create({
      firstName: "Test",
      lastName: "Admin",
      username: "admin_unit06",
      email: "admin_unit06@gloxad.com",
      password: "Password123!",
      role: "admin",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  const studentToken = signToken({ sub: studentUser._id, role: studentUser.role, tokenVersion: studentUser.tokenVersion });
  const instructorToken = signToken({ sub: instructorUser._id, role: instructorUser.role, tokenVersion: instructorUser.tokenVersion });

  // Cleanup test courses
  await Course.deleteMany({ title: { $regex: /unit06/i } });

  // Seed Test Courses
  const courseA = await Course.create({
    title: "Unit06 Web Development Bootcamp",
    slug: "unit06-web-development-bootcamp",
    subtitle: "Master React and Node",
    category: "Development & Engineering",
    subCategory: "Web Development",
    topic: "Full-Stack",
    level: "beginner",
    courseType: "paid",
    price: 25000,
    discountPrice: 18000,
    status: "published",
    instructor: instructorUser._id,
    enrolledCount: 100,
    rating: { average: 4.8, count: 50 },
    skills: ["React", "Node.js", "MongoDB"],
    description: "Learn full-stack web development from scratch.",
    modules: [
      {
        title: "Module 1: Fundamentals",
        lessons: [
          {
            title: "Lesson 1: Intro",
            duration: "10:00",
            isFreePreview: true,
            videoUrl: "https://gloxad-media.s3.amazonaws.com/courses/videos/unit06-free.mp4"
          },
          {
            title: "Lesson 2: Advanced Concepts",
            duration: "25:00",
            isFreePreview: false,
            videoUrl: "https://gloxad-media.s3.amazonaws.com/courses/videos/unit06-paid.mp4"
          }
        ],
        quizzes: [
          {
            title: "Quiz 1",
            passingScore: 70,
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
    ]
  });

  const courseB = await Course.create({
    title: "Unit06 Python Data Science",
    slug: "unit06-python-data-science",
    subtitle: "Data analysis with Python",
    category: "Data & AI",
    subCategory: "Data Science",
    topic: "Python",
    level: "advanced",
    courseType: "free",
    price: 0,
    status: "published",
    instructor: instructorUser._id,
    enrolledCount: 500,
    rating: { average: 4.2, count: 20 },
    skills: ["Python", "Pandas"],
    description: "Data analysis masterclass."
  });

  const courseC = await Course.create({
    title: "Unit06 Unpublished Draft Course",
    slug: "unit06-unpublished-draft-course",
    category: "Design & UX",
    courseType: "paid",
    price: 15000,
    status: "draft",
    instructor: instructorUser._id
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Test 1: Public Course Listing (Default Pagination & Excludes Drafts)
  await test("Test 1: Public Course Listing (Default Pagination & Draft Exclusion)", async () => {
    const res = await fetch(`${baseUrl}/api/courses`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(data.courses)) throw new Error("Expected courses array");
    if (!data.pagination) throw new Error("Expected pagination metadata");
    
    // Ensure draft course C is excluded
    const draft = data.courses.find(c => c.slug === "unit06-unpublished-draft-course");
    if (draft) throw new Error("Unpublished draft course was returned in public catalog");
    
    // Ensure primary keys use _id (Rule 5)
    if (!data.courses[0]._id) throw new Error("Course object missing _id primary key");
  });

  // Test 2: Search & Multi-Filter Query
  await test("Test 2: Search & Multi-Filter Query", async () => {
    const res = await fetch(`${baseUrl}/api/courses?search=bootcamp&category=development-engineering&courseType=paid`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (data.courses.length !== 1) throw new Error(`Expected 1 course, got ${data.courses.length}`);
    if (data.courses[0].slug !== "unit06-web-development-bootcamp") {
      throw new Error(`Unexpected course slug: ${data.courses[0].slug}`);
    }
  });

  // Test 3: Enum & Price Range Filtering
  await test("Test 3: Enum & Price Range Filtering", async () => {
    const res = await fetch(`${baseUrl}/api/courses?level=advanced&maxPrice=100`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (data.courses.length !== 1) throw new Error(`Expected 1 matching course, got ${data.courses.length}`);
    if (data.courses[0].slug !== "unit06-python-data-science") {
      throw new Error(`Unexpected course slug: ${data.courses[0].slug}`);
    }
  });

  // Test 4: Sorting (Popularity sort by enrolledCount descending)
  await test("Test 4: Sorting by Popularity", async () => {
    const res = await fetch(`${baseUrl}/api/courses?sort=popular`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    // courseB has 500 enrolled, courseA has 100
    const unit06Courses = data.courses.filter(c => c.slug.startsWith("unit06-"));
    if (unit06Courses[0].slug !== "unit06-python-data-science") {
      throw new Error(`Expected most popular course first, got ${unit06Courses[0].slug}`);
    }
  });

  // Test 5: Public Course View by Slug (Unauthenticated Content Shield Rule 3)
  await test("Test 5: Public Course View by Slug (Content Shield Verification)", async () => {
    const res = await fetch(`${baseUrl}/api/courses/unit06-web-development-bootcamp`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    if (!data.course) throw new Error("Expected course payload");
    if (data.isEnrolled !== false) throw new Error("Expected isEnrolled to be false for public user");

    const mod = data.course.modules[0];
    const freeLesson = mod.lessons.find(l => l.isFreePreview === true);
    const paidLesson = mod.lessons.find(l => l.isFreePreview === false);

    // Rule 3 Content Protection Verification:
    if (!freeLesson.videoUrl) throw new Error("Free preview lesson videoUrl was incorrectly redacted");
    if (paidLesson.videoUrl !== null) throw new Error(`Paid lesson videoUrl was exposed to public user: ${paidLesson.videoUrl}`);

    // Quiz answer key shielding check:
    const quizQuestion = mod.quizzes[0].questions[0];
    if ("correctOptionIndex" in quizQuestion) {
      throw new Error("Quiz correctOptionIndex answer key was exposed to unauthenticated caller");
    }
  });

  // Test 6: Single Course View by ID
  await test("Test 6: Single Course View by ObjectId", async () => {
    const res = await fetch(`${baseUrl}/api/courses/${courseA._id.toString()}`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (data.course.slug !== "unit06-web-development-bootcamp") {
      throw new Error(`Unexpected course slug: ${data.course.slug}`);
    }
  });

  // Test 7: Instructor/Admin Course View (Unshielded Access)
  await test("Test 7: Instructor Course View (Unshielded Access)", async () => {
    const res = await fetch(`${baseUrl}/api/courses/unit06-web-development-bootcamp`, {
      headers: {
        "Authorization": `Bearer ${instructorToken}`
      }
    });
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (data.isEnrolled !== true) throw new Error("Expected isEnrolled to be true for instructor");

    const mod = data.course.modules[0];
    const paidLesson = mod.lessons.find(l => l.isFreePreview === false);
    if (!paidLesson.videoUrl) throw new Error("Paid lesson videoUrl was incorrectly redacted for instructor");

    const quizQuestion = mod.quizzes[0].questions[0];
    if (quizQuestion.correctOptionIndex !== 0) {
      throw new Error(`Quiz correctOptionIndex missing or wrong for instructor: ${quizQuestion.correctOptionIndex}`);
    }
  });

  // Test 8: Non-Existent Course Slug
  await test("Test 8: Non-Existent Course Slug (404 & Uniform Error Envelope)", async () => {
    const res = await fetch(`${baseUrl}/api/courses/non-existent-course-slug-12345`);
    const data = await res.json();
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    if (data.error !== "Course not found") throw new Error(`Unexpected error message: ${data.error}`);
  });

  // Test 9: Verify API Documentation Web Portal Integration
  await test("Test 9: Verify API Documentation Web Portal Integration", async () => {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!html.includes("/api/courses") || !html.includes("ep-course-detail")) {
      throw new Error("API docs portal HTML missing course catalog route references");
    }
  });

  // Cleanup test data
  await Course.deleteMany({ title: { $regex: /unit06/i } });
  await User.deleteMany({ email: { $in: ["student_unit06@gloxad.com", "instructor_unit06@gloxad.com", "admin_unit06@gloxad.com"] } });

  server.close();
  await mongoose.disconnect();

  console.log(`\n📊 Verification Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 All Unit 06 API endpoints tested & 100% verified!");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
