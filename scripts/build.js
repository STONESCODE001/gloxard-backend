import fs from "fs";
import path from "path";
import { execSync } from "child_process";

console.log("🔍 Running build verification & syntax validation...");

let hasError = false;
let fileCount = 0;

function checkDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkDirectory(fullPath);
    } else if (entry.name.endsWith(".js")) {
      fileCount++;
      try {
        execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
        console.log(`  ✓ Syntax check passed: ${path.relative(process.cwd(), fullPath)}`);
      } catch (err) {
        console.error(`  ✗ Syntax error in ${fullPath}:`, err.message);
        hasError = true;
      }
    }
  }
}

// Check root index.js if present
if (fs.existsSync(path.resolve("index.js"))) {
  fileCount++;
  try {
    execSync(`node --check "index.js"`, { stdio: "pipe" });
    console.log(`  ✓ Syntax check passed: index.js`);
  } catch (err) {
    console.error(`  ✗ Syntax error in index.js:`, err.message);
    hasError = true;
  }
}

checkDirectory(path.resolve("src"));

if (hasError) {
  console.error("\n❌ Build check failed due to syntax errors.");
  process.exit(1);
} else {
  console.log(`\n🎉 Build check successful! Verified ${fileCount} files with zero syntax errors.`);
}
