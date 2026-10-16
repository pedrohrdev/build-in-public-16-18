import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";

if (process.platform !== "win32") {
  console.error("Este instalador cria o atalho do Windows. Execute no Windows.");
  process.exit(1);
}

const app = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.join(app, ".env.local");
if (!fs.existsSync(envFile)) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  let user;
  try {
    do {
      user = (await prompt.question("Seu usuario do GitHub (sem @; Enter para usar sem GitHub): ")).trim();
    } while (user && !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(user));
  } finally {
    prompt.close();
  }
  const logs = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Habitos", "registros");
  fs.mkdirSync(logs, { recursive: true });
  fs.writeFileSync(envFile, `LOGS_ROOT=${JSON.stringify(logs.replaceAll("\\", "/"))}\nGITHUB_USER=${user}\n`, { flag: "wx" });
  console.log(`Seus registros ficam em: ${logs}`);
} else {
  console.log(".env.local existente preservado. Confira LOGS_ROOT e GITHUB_USER para usar seus proprios dados.");
}

const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(app, "scripts", "atalho-windows.ps1"), "-AppDir", app], { stdio: "inherit" });
if (result.error || result.status !== 0) {
  console.error("Nao foi possivel criar o atalho.", result.error?.message || "");
  process.exit(1);
}
console.log("Pronto! Abra 'Meus habitos' na Area de Trabalho. Nao mova a pasta do repo sem executar este comando novamente.");
