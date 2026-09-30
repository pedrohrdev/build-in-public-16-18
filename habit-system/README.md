# Sistema de hábitos — 16 → 18

Painel de hábitos que lê direto os registros diários em `.md` deste repositório
(`my-old-version/<mês>/`, `september/`, ...). **Os arquivos originais nunca são alterados nem apagados**:
tudo é lido a cada acesso e cada dia guarda o texto bruto completo.

## Rodar

```bash
cd habit-system
npm install
npm run dev        # http://localhost:3000
```

## Abas

A barra no topo troca de aba (a aba fica no endereço, ex.: `/#mes`, então recarregar e o "voltar" funcionam):

- **Hoje**: o topo animado (Day, sequência 🔥), o que você fez hoje comparado com a sua média,
  o que faltou, hoje x ontem, últimos 7 dias, esta semana x a passada, e o resumo geral
  (consistência, sequência, totais por hábito).
- **Mês**: escolha o mês (← → ou a lista). Totais do mês, dias com estudo, comparação com o mês anterior,
  melhor dia, calendário, horas e páginas por dia, e a lista de dias.
  Embaixo, **Completar o histórico**:
  - *Um dia específico*: cria o `.md` daquele dia. Dias anteriores ao último registro viram
    “registro retroativo” (sem número de Day, para não bagunçar a contagem).
  - *Total do mês inteiro*: para meses sem os dias exatos. Cria `month-summary-MM-AAAA.md` na pasta do mês.
    O valor conta como o total do mês: dias já registrados fazem parte dele, e só a diferença
    entra nos totais como “sem dia definido”.
- **Ano**: números do ano, heatmap de todos os dias (com filtro por hábito), visão geral
  (acumulado, horas por mês, dias da semana) e os cards de mês a mês.
- **Hábitos**: uma seção para Programação, Inglês e Leitura, e uma de **Commits** que busca sozinha
  no GitHub (@pedrohrdev): total, sequência, commits por mês, heatmap, repositórios mais ativos,
  horário em que você commita e commits recentes. O painel de cada dia também lista os commits daquele dia.
- **Conquistas**, **Diário** (busca) e **Dados** (relatório de importação e resumos mensais).

Clicar em um dia abre o dia por cima da página (← → navegam, Esc fecha).
O botão **Registrar hoje** abre a gaveta de registro. Nada nunca é sobrescrito.

Os endereços antigos `/dias`, `/novo` e `/relatorio` levam para a aba correspondente.

## Atalho na área de trabalho

`scripts/abrir.sh` sobe o servidor (com `GITHUB_TOKEN=$(gh auth token)`) se ele não estiver rodando
e abre `http://localhost:3000` no Chrome. `scripts/abrir.sh --parar` desliga o servidor.
O atalho "Hábitos 16→18" (área de trabalho e menu de aplicativos) chama esse script;
clique direito nele → "Parar servidor". O log fica em `data/servidor.log`.

## Conferir a importação no terminal

```bash
npm run relatorio   # lista todos os dias extraídos e exporta tudo em data/export.json
```

## Como os arquivos são lidos

- Formato antigo (abr–jun): `Study / Time / I Learned / Note of the Day`.
- Formato novo (jul em diante): tabela Programming / English / Read.
- Texto livre (dias sem estudo): o texto inteiro é guardado.
- Arquivos com vários dias (`18-19-20-21-04-2026.md`) viram um dia para cada data.
- A data vem do nome do arquivo; se o mês do nome não bate com a pasta
  (ex.: `september/10-10-2026.md`), usa a data do título.

Para ler de outra pasta: `LOGS_ROOT=/caminho npm run dev`.

## Commits do GitHub

Os commits vêm da API de busca do GitHub e ficam em cache por 30 min (`data/github-cache.json`).
Sem token só entram repositórios públicos. Para incluir os privados (e ter limite maior de buscas):

```bash
GITHUB_TOKEN=$(gh auth token) npm run dev
```

Outro usuário: `GITHUB_USER=nome npm run dev`.
