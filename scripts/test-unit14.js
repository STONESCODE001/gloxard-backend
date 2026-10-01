import http from "http";
import app from "../src/app.js";

async function runUnit14Tests() {
  console.log("🧪 Starting Unit 14 API Documentation & Endpoint Verification Tests...");

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
      if (condition) {
        console.log(`  ✓ PASSED: ${message}`);
        passed++;
      } else {
        console.error(`  ❌ FAILED: ${message}`);
        failed++;
      }
    };

    try {
      // Test 1: GET / (Interactive API Documentation Portal)
      const docsRes = await fetch(`${baseUrl}/`);
      const docsBody = await docsRes.text();

      assert(docsRes.status === 200, `GET / returns HTTP 200 OK (got ${docsRes.status})`);
      assert(docsRes.headers.get("content-type").includes("text/html"), `GET / returns Content-Type text/html`);
      assert(docsBody.includes("<!DOCTYPE html>"), `Docs HTML contains <!DOCTYPE html>`);
      assert(docsBody.includes("Gloxad Academy API Reference v1.0"), `Docs HTML contains title "Gloxad Academy API Reference v1.0"`);
      assert(docsBody.includes('id="apiSearchInput"'), `Docs HTML contains search input #apiSearchInput`);
      assert(docsBody.includes('id="globalJwtToken"'), `Docs HTML contains JWT token persistence input #globalJwtToken`);
      assert(docsBody.includes("Core Platform Architectural Invariants"), `Docs HTML contains Architectural Invariants Banner`);
      assert(docsBody.includes("Rule 1: Uniform Error Schema"), `Docs HTML outlines Rule 1`);
      assert(docsBody.includes("Rule 2: Direct S3 Media Offloading"), `Docs HTML outlines Rule 2`);
      assert(docsBody.includes("Rule 3: Server Content Protection"), `Docs HTML outlines Rule 3`);
      assert(docsBody.includes("Rule 4: Paystack Verification"), `Docs HTML outlines Rule 4`);
      assert(docsBody.includes("Rule 5: Identifier Standard"), `Docs HTML outlines Rule 5`);
      assert(docsBody.includes("initSandboxDrawers"), `Docs HTML contains interactive live sandbox engine JS`);
      assert(docsBody.includes("handleTokenChange"), `Docs HTML contains localStorage token persistence handler`);

      // Test 2: GET /api/health
      const healthRes = await fetch(`${baseUrl}/api/health`);
      const healthBody = await healthRes.json();

      assert(healthRes.status === 200, `GET /api/health returns HTTP 200 OK`);
      assert(healthBody.status === "ok", `GET /api/health returns status "ok"`);

      // Summary
      console.log(`\n📊 Unit 14 Test Results: ${passed} passed, ${failed} failed.`);
      server.close();
      if (failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (err) {
      console.error("Test Execution Error:", err);
      server.close();
      process.exit(1);
    }
  });
}

runUnit14Tests();
