import { readPreferences } from "@/lib/preferences-store";
import { connection } from "next/server";
import DashboardView from "@/components/dashboard";
import type { Report } from "@/lib/dashboard";
import { loadLogs, toDayLite, toSummaryLite } from "@/lib/logs";
import { localToday } from "@/lib/stats";

export default async function Home() {
  await connection();
  const logs = loadLogs();
  const settings = readPreferences();
  const report: Report = {
    root: logs.root,
    files: logs.files.length,
    ignored: logs.ignoredFiles,
    duplicates: logs.duplicateDates,
    missing: logs.missingDates,
    warnings: logs.files.filter((f) => f.warnings.length),
  };
  return (
    <DashboardView
      settings={settings}
      days={logs.days.map(toDayLite)}
      summaries={logs.monthSummaries.map(toSummaryLite)}
      report={report}
      today={localToday()}
    />
  );
}
