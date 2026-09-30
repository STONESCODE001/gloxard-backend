import mongoose from "mongoose";
import { app } from "../src/app.js";
import connectDB from "../src/config/db.js";
import { User } from "../src/models/User.model.js";
import { Category } from "../src/models/Category.model.js";
import { signToken } from "../src/utils/jwt.js";

async function runTests() {
  console.log("🚀 Initializing Unit 05 Automated API Verification Suite...\n");

  await connectDB();

  // 1. Setup mock users in DB if not exist
  let studentUser = await User.findOne({ email: "student_unit05@gloxad.com" });
  if (!studentUser) {
    studentUser = await User.create({
      firstName: "Test",
      lastName: "Student",
      username: "student_unit05",
      email: "student_unit05@gloxad.com",
      password: "Password123!",
      role: "student",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  let adminUser = await User.findOne({ email: "admin_unit05@gloxad.com" });
  if (!adminUser) {
    adminUser = await User.create({
      firstName: "Test",
      lastName: "Admin",
      username: "admin_unit05",
      email: "admin_unit05@gloxad.com",
      password: "Password123!",
      role: "admin",
      isEmailVerified: true,
      approvalStatus: "approved"
    });
  }

  const studentToken = signToken({ sub: studentUser._id, role: studentUser.role, tokenVersion: studentUser.tokenVersion });
  const adminToken = signToken({ sub: adminUser._id, role: adminUser.role, tokenVersion: adminUser.tokenVersion });

  // Cleanup test categories
  await Category.deleteMany({ name: { $regex: /unit05/i } });

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

  // Test 1: Fetch Categories List (Public Access)
  await test("Test 1: Fetch Categories List (Public Access)", async () => {
    const res = await fetch(`${baseUrl}/api/categories`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(data.categories)) throw new Error("Expected categories array");
  });

  // Test 2: Create Category (Unauthenticated Call)
  await test("Test 2: Create Category (Unauthenticated Call)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unit05 Test 1" })
    });
    const data = await res.json();
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    if (data.error !== "Authentication token missing or malformed") throw new Error(`Unexpected error text: ${data.error}`);
  });

  // Test 3: Create Category (Non-Admin User Call)
  await test("Test 3: Create Category (Non-Admin User Call)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${studentToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Unit05 Test 2" })
    });
    const data = await res.json();
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    if (data.error !== "Access denied. Admin role required") throw new Error(`Unexpected error text: ${data.error}`);
  });

  // Test 4: Create Category (Missing Required Name)
  await test("Test 4: Create Category (Missing Required Name)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (data.error !== "Category name is required") throw new Error(`Unexpected error text: ${data.error}`);
  });

  let createdCatId = null;

  // Test 5: Create Category (Valid Admin Creation)
  await test("Test 5: Create Category (Valid Admin Creation)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Unit05 Design & UX",
        icon: "paint-brush",
        order: 3,
        subCategories: [
          { name: "UI Design", topics: ["Figma", "Design Systems"] },
          { name: "UX Research", topics: ["User Interviews", "Usability Testing"] }
        ]
      })
    });
    const data = await res.json();
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
    if (data.message !== "Category created successfully") throw new Error(`Unexpected message: ${data.message}`);
    if (data.category.slug !== "unit05-design-ux") throw new Error(`Unexpected slug: ${data.category.slug}`);
    if (data.category.subCategories[0].slug !== "ui-design") throw new Error(`Unexpected subcategory slug: ${data.category.subCategories[0].slug}`);
    createdCatId = data.category._id;
  });

  // Test 6: Create Category (Duplicate Name Prevention)
  await test("Test 6: Create Category (Duplicate Name Prevention)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "unit05 design & ux" })
    });
    const data = await res.json();
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
    if (data.error !== "Category with this name already exists") throw new Error(`Unexpected error text: ${data.error}`);
  });

  // Test 7: Update Category (Valid Update)
  await test("Test 7: Update Category (Valid Update)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories/${createdCatId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Unit05 Design & User Experience",
        order: 1
      })
    });
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    if (data.category.slug !== "unit05-design-user-experience") throw new Error(`Unexpected updated slug: ${data.category.slug}`);
  });

  // Test 8: Delete Category (Course Dependency Safeguard)
  await test("Test 8: Delete Category (Course Dependency Safeguard)", async () => {
    // Register temporary Course schema for testing dependency check
    if (!mongoose.models.Course) {
      mongoose.model("Course", new mongoose.Schema({ title: String, category: String }));
    }
    const Course = mongoose.model("Course");
    const testCourse = await Course.create({ title: "Unit05 Sample Course", category: "Unit05 Design & User Experience" });

    const res = await fetch(`${baseUrl}/api/admin/categories/${createdCatId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${adminToken}`
      }
    });
    const data = await res.json();
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}: ${JSON.stringify(data)}`);
    if (data.error !== "Cannot delete category currently associated with active courses") {
      throw new Error(`Unexpected error message: ${data.error}`);
    }

    // Clean up test course
    await Course.deleteOne({ _id: testCourse._id });
  });

  // Test 9: Delete Category (Unreferenced Category Deletion)
  await test("Test 9: Delete Category (Unreferenced Category Deletion)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/categories/${createdCatId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${adminToken}`
      }
    });
    const data = await res.json();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    if (data.message !== "Category deleted successfully") throw new Error(`Unexpected message: ${data.message}`);
  });

  // Test 10: Verify API Documentation Web Portal Integration
  await test("Test 10: Verify API Documentation Web Portal Integration", async () => {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!html.includes("/api/categories") || !html.includes("/api/admin/categories")) {
      throw new Error("API docs portal HTML missing category route references");
    }
  });

  // Clean up mock users & categories
  await User.deleteMany({ email: { $in: ["student_unit05@gloxad.com", "admin_unit05@gloxad.com"] } });
  await Category.deleteMany({ name: { $regex: /unit05/i } });

  server.close();
  await mongoose.disconnect();

  console.log(`\n📊 Verification Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 All Unit 05 API endpoints tested & 100% verified!");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
