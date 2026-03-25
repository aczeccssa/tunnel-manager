import fs from "node:fs";

const {
  RELEASE_VERSION,
  RELEASE_NOTES = "",
  RELEASE_PUBLISHED_AT,
  RELEASE_DOWNLOAD_URL,
  RELEASE_SIGNATURE,
  RELEASE_HTML_URL,
  MANIFEST_OUTPUT_PATH,
  PLATFORM_KEY,
} = process.env;

for (const [key, value] of Object.entries({
  RELEASE_VERSION,
  RELEASE_PUBLISHED_AT,
  RELEASE_DOWNLOAD_URL,
  RELEASE_SIGNATURE,
  RELEASE_HTML_URL,
  MANIFEST_OUTPUT_PATH,
  PLATFORM_KEY,
})) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const payload = {
  version: RELEASE_VERSION,
  notes: RELEASE_NOTES || undefined,
  pub_date: RELEASE_PUBLISHED_AT,
  platforms: {
    [PLATFORM_KEY]: {
      url: RELEASE_DOWNLOAD_URL,
      signature: RELEASE_SIGNATURE,
    },
  },
};

fs.writeFileSync(MANIFEST_OUTPUT_PATH, JSON.stringify(payload, null, 2));
console.log(`Wrote updater manifest to ${MANIFEST_OUTPUT_PATH}`);
