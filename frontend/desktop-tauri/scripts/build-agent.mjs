import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = resolve(root, "src-tauri", "Cargo.toml");
execFileSync("cargo", ["build", "--release", "--manifest-path", manifest, "--bin", "screen-monitor-agent"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TAURI_CONFIG: JSON.stringify({ bundle: { externalBin: [] } }),
  },
});
const destinationDirectory = resolve(root, "src-tauri", "binaries");
mkdirSync(destinationDirectory, { recursive: true });
copyFileSync(
  resolve(root, "src-tauri", "target", "release", "screen-monitor-agent.exe"),
  resolve(destinationDirectory, "screen-monitor-agent-x86_64-pc-windows-msvc.exe"),
);
