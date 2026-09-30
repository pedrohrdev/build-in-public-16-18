// Uso: npm run relatorio  — confere a importação e exporta tudo para data/export.json
import fs from "node:fs";
import path from "node:path";
import { loadLogs, formatDuration } from "../lib/logs.ts";

const r = loadLogs();
console.log(`Raiz: ${r.root}`);
console.log(`Arquivos diários lidos: ${r.files.length}`);
console.log(`Dias gerados: ${r.days.length}`);
console.log(`Outros .md (não diários, não importados): ${r.ignoredFiles.join(", ") || "nenhum"}`);
console.log(`Resumos mensais: ${r.monthSummaries.map((m) => `${m.key} (${m.file})`).join(", ") || "nenhum"}`);
console.log(`Datas duplicadas: ${r.duplicateDates.join(", ") || "nenhuma"}`);
console.log(`Dias sem registro (${r.missingDates.length}): ${r.missingDates.join(", ")}`);
console.log("");
for (const d of r.days) {
  console.log(
    [d.date, `#${d.dayNumber ?? "?"}`, d.format.padEnd(5), `prog ${formatDuration(d.programmingMin)}`,
     `ing ${formatDuration(d.englishMin)}`, `pág ${d.pagesRead ?? "—"}`, `total ${formatDuration(d.totalMin)}`,
     `nota ${d.score ?? "—"}`, d.file].join(" | "),
  );
  for (const w of d.warnings) console.log(`    ⚠ ${w}`);
}
const out = path.join(import.meta.dirname, "..", "data", "export.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(r, null, 2));
console.log(`\nExportado: ${out}`);
