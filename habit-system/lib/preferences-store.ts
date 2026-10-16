import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { logsRoot } from "./logs.ts";
import { DEFAULT_PREFERENCES, validatePreferences, type Preferences } from "./preferences.ts";
const settingsFile = () => path.join(process.cwd(), "data", `preferences-${createHash("sha256").update(logsRoot()).digest("hex").slice(0, 16)}.json`);
export function readPreferences(): { preferences: Preferences; configured: boolean } {
  const file = settingsFile();
  if (!fs.existsSync(file)) return { preferences: { ...DEFAULT_PREFERENCES, github: process.env.GITHUB_USER !== "" }, configured: false };
  return { preferences: validatePreferences(JSON.parse(fs.readFileSync(file, "utf8"))), configured: true };
}
export function writePreferences(preferences: Preferences) {
  const file = settingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(validatePreferences(preferences), null, 2));
  fs.renameSync(temp, file);
}
