import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gitDir = path.join(root, ".git");
const hooksPath = ".githooks";
const preCommitPath = path.join(root, hooksPath, "pre-commit");

if (process.env.CI === "true") {
  console.log("Skipping git hooks installation in CI");
  process.exit(0);
}

if (!fs.existsSync(gitDir)) {
  console.log("Skipping git hooks installation: .git directory not found");
  process.exit(0);
}

if (!fs.existsSync(preCommitPath)) {
  console.error(`Missing git hook: ${preCommitPath}`);
  process.exit(1);
}

try {
  fs.chmodSync(preCommitPath, 0o755);
  execFileSync("git", ["config", "core.hooksPath", hooksPath], {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`Configured git hooks path: ${hooksPath}`);
} catch (error) {
  console.error("Failed to configure git hooks");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
