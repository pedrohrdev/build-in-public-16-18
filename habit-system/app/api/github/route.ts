import { loadGithub } from "@/lib/github";
import { localToday } from "@/lib/format";

// Dados do GitHub para o painel (carregados depois da página, para não atrasar a abertura).
// O período vai da criação da conta até hoje.
export async function GET() {
  return Response.json(await loadGithub(localToday()));
}
