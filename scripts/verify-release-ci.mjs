import { execFileSync } from "node:child_process";

const {
  GH_REPOSITORY,
  HEAD_SHA,
  CI_WORKFLOW_NAME = "CI",
  VERIFY_CI_MAX_ATTEMPTS = "5",
  VERIFY_CI_DELAY_SECONDS = "15",
} = process.env;

if (!GH_REPOSITORY) {
  console.error("Missing required environment variable: GH_REPOSITORY");
  process.exit(1);
}

if (!HEAD_SHA) {
  console.error("Missing required environment variable: HEAD_SHA");
  process.exit(1);
}

const maxAttempts = Number.parseInt(VERIFY_CI_MAX_ATTEMPTS, 10);
const delaySeconds = Number.parseInt(VERIFY_CI_DELAY_SECONDS, 10);

if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
  console.error(`Invalid VERIFY_CI_MAX_ATTEMPTS: ${VERIFY_CI_MAX_ATTEMPTS}`);
  process.exit(1);
}

if (!Number.isInteger(delaySeconds) || delaySeconds < 1) {
  console.error(`Invalid VERIFY_CI_DELAY_SECONDS: ${VERIFY_CI_DELAY_SECONDS}`);
  process.exit(1);
}

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function ghApi(pathname) {
  const output = execFileSync(
    "gh",
    ["api", "-H", "Accept: application/vnd.github+json", pathname],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  return JSON.parse(output);
}

function fetchWorkflowRuns() {
  const query = new URLSearchParams({
    event: "push",
    per_page: "100",
    head_sha: HEAD_SHA,
  });

  return ghApi(`/repos/${GH_REPOSITORY}/actions/runs?${query.toString()}`);
}

function summarizeRuns(runs) {
  if (runs.length === 0) {
    console.log("No matching workflow runs found yet.");
    return;
  }

  console.log("Recent matching workflow runs:");
  for (const run of runs.slice(0, 5)) {
    console.log(`- ${run.name}: status=${run.status}, conclusion=${run.conclusion ?? "null"}, url=${run.html_url}`);
  }
}

let lastRuns = [];
let lastError = null;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`Checking CI gate attempt ${attempt}/${maxAttempts} for ${HEAD_SHA}`);

  try {
    const payload = fetchWorkflowRuns();
    const runs = (payload.workflow_runs ?? [])
      .filter((run) => run.name === CI_WORKFLOW_NAME && run.head_sha === HEAD_SHA)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    lastRuns = runs;
    summarizeRuns(runs);

    const completedSuccess = runs.find(
      (run) => run.status === "completed" && run.conclusion === "success",
    );
    if (completedSuccess) {
      console.log(`Using CI gate: ${completedSuccess.html_url}`);
      process.exit(0);
    }

    const completedFailure = runs.find(
      (run) => run.status === "completed" && run.conclusion && run.conclusion !== "success",
    );
    if (completedFailure) {
      console.error(`CI gate is not green for commit ${HEAD_SHA}.`);
      console.error(`Run URL: ${completedFailure.html_url}`);
      console.error(`Conclusion: ${completedFailure.conclusion}`);
      process.exit(1);
    }

    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    console.error(`Transient GitHub API check failure: ${lastError.message}`);
  }

  if (attempt < maxAttempts) {
    console.log(`Waiting ${delaySeconds}s before retrying CI gate lookup...`);
    sleep(delaySeconds);
  }
}

console.error(`No successful completed CI run found for commit ${HEAD_SHA} after ${maxAttempts} attempts.`);
summarizeRuns(lastRuns);
if (lastError) {
  console.error(`Last API error: ${lastError.message}`);
}
process.exit(1);
