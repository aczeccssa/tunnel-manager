import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tauriConfig = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const cargoToml = fs.readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8");

const cargoVersionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);

if (!cargoVersionMatch) {
  console.error("Unable to find version in src-tauri/Cargo.toml");
  process.exit(1);
}

const versions = {
  package: packageJson.version,
  tauriConfig: tauriConfig.version,
  cargo: cargoVersionMatch[1],
};

const unique = new Set(Object.values(versions));

if (unique.size !== 1) {
  console.error("Version mismatch detected:");
  for (const [source, version] of Object.entries(versions)) {
    console.error(`- ${source}: ${version}`);
  }
  process.exit(1);
}

console.log(`Versions are in sync at ${packageJson.version}`);
