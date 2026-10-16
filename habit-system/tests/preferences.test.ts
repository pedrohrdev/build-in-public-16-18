import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_PREFERENCES, validatePreferences } from "../lib/preferences.ts";
import { buildDashboard, computeExtras, type DayLite } from "../lib/dashboard.ts";
import { loadLogs, toDayLite, toSummaryLite } from "../lib/logs.ts";

const day: DayLite = { date: "2026-10-15", dayNumber: 1, prog: 60, eng: 30, pages: 10, minutes: 90, studied: true, score: null, study: "", learned: "", notes: "", raw: "", file: "15-10-2026.md", warnings: [], groupedWith: [], custom: { "custom-walk": 45, "custom-water": 8 } };

test("programming alone excludes English and reading from totals and achievements", () => {
  const preferences = { ...DEFAULT_PREFERENCES, habits: DEFAULT_PREFERENCES.habits.map(h => ({ ...h, enabled: h.id === "programming" })) };
  const data = buildDashboard([day], [], day.date, preferences);
  assert.equal(data.overall.totalMinutes, 60);
  assert.equal(data.days[0].minutes, 60);
  assert.equal(data.achievements.some(a => /^[er]\d/.test(a.id)), false);
  assert.equal(day.minutes, 90, "original input must stay unchanged");
});

test("custom time and quantity habits contribute to streaks, charts and monthly extras", () => {
  const preferences = validatePreferences({ version: 1, name: "Ana", github: false, habits: [
    { id: "custom-walk", label: "Caminhada", enabled: true, unit: "min" },
    { id: "custom-water", label: "Água", enabled: true, unit: "count" },
  ] });
  const summary = { key: "2026-10", prog: null, eng: null, pages: null, notes: "", file: "summary.md", raw: "", custom: { "custom-walk": 120, "custom-water": 20 } };
  const data = buildDashboard([day], computeExtras([day], [summary]), day.date, preferences);
  assert.equal(data.overall.totalMinutes, 120);
  assert.equal(data.habits["custom-walk"].total, 120);
  assert.equal(data.habits["custom-water"].total, 20);
  assert.equal(data.habits["custom-walk"].cumulative.at(-1)?.value, 120);
  assert.equal(data.months[0].values["custom-water"], 20);
  assert.equal(data.overall.currentStreak, 1);
});

test("quantity-only routines count as active days without inventing study time", () => {
  const preferences = validatePreferences({ version: 1, name: "", github: false, habits: [{ id: "custom-water", label: "Água", enabled: true, unit: "count" }] });
  const data = buildDashboard([day], [], day.date, preferences);
  assert.equal(data.overall.totalMinutes, 0);
  assert.equal(data.overall.studiedDays, 1);
  assert.equal(data.overall.currentStreak, 1);
});

test("empty and invalid selections are rejected", () => {
  assert.throws(() => validatePreferences({ ...DEFAULT_PREFERENCES, habits: [] }));
  assert.throws(() => validatePreferences({ ...DEFAULT_PREFERENCES, habits: [...DEFAULT_PREFERENCES.habits, DEFAULT_PREFERENCES.habits[0]] }));
  assert.throws(() => validatePreferences({ ...DEFAULT_PREFERENCES, habits: [{ id: "custom-x", label: "Teste", unit: "invalid", enabled: true }] }));
});

test("old Markdown and custom records load together without losing original files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "habits-parser-"));
  try {
    const raw = '<!-- habits-v1: {"custom-walk":45} -->\n```md\n# Day 1 — 15/10/2026\n\n## Study Time\n| Topic | Today | Month Total |\n|---|---|---|\n| Programming | 1hr | 1hr |\n| English | 30min | 30min |\n| Read | 10 | 10 pages |\n```\n';
    fs.writeFileSync(path.join(root, "15-10-2026.md"), raw);
    fs.writeFileSync(path.join(root, "month-summary-10-2026.md"), '<!-- habits-v1: {"custom-walk":120} -->\n# Month Summary — 10/2026\n| Topic | Month Total |\n| Programming | 2hr |\n');
    const logs = loadLogs(root);
    assert.equal(logs.days.length, 1);
    assert.equal(toDayLite(logs.days[0]).custom?.["custom-walk"], 45);
    assert.equal(toDayLite(logs.days[0]).prog, 60);
    assert.equal(toSummaryLite(logs.monthSummaries[0]).custom?.["custom-walk"], 120);
    assert.equal(fs.readFileSync(path.join(root, "15-10-2026.md"), "utf8"), raw);
    assert.equal(buildDashboard([], [], day.date).overall.loggedDays, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("disabling a custom time habit cannot leak its recorded time into the remaining routine", () => {
  const source = { ...day, minutes: 135 };
  const data = buildDashboard([source], [], day.date, { ...DEFAULT_PREFERENCES, habits: [...DEFAULT_PREFERENCES.habits, { id: "custom-walk", label: "Caminhada", unit: "min", enabled: false }] });
  assert.equal(data.days[0].minutes, 90);
  assert.equal(data.overall.totalMinutes, 90);
});

test("English-only and custom-only Markdown still parse notes, learning and values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "habits-custom-parser-"));
  try {
    fs.writeFileSync(path.join(root, "14-10-2026.md"), '# Day 1 — 14/10/2026\n## What I Learned Today\nVocabulary\n## Study Time\n| Topic | Today | Month Total |\n| English | 30min | 30min |\n## Notes\nPractice\n');
    fs.writeFileSync(path.join(root, "15-10-2026.md"), '<!-- habits-v1: {"custom-walk":45} -->\n# Day 2 — 15/10/2026\n## What I Learned Today\nNew route\n## Study Time\n| Topic | Today | Month Total |\n| Custom: Caminhada | 45min | 45min |\n## Notes\nOutside\n');
    const logs = loadLogs(root);
    assert.equal(logs.days[0].englishMin, 30);
    assert.match(logs.days[0].learned, /Vocabulary/);
    assert.match(logs.days[1].notes, /Outside/);
    assert.equal(logs.days[1].custom?.["custom-walk"], 45);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
