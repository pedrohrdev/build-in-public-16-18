# Hábitos 16 → 18

## Começar no Windows

Com **Node.js LTS e Git instalados**, abra o PowerShell ou o Prompt de Comando e execute uma linha de cada vez:

```powershell
git clone https://github.com/pedrohrdev/build-in-public-16-18.git
cd build-in-public-16-18/habit-system
npm.cmd install
npm.cmd run setup:windows
```

Informe **seu usuário do GitHub, sem `@`**. Depois, clique em **Meus habitos** na Área de Trabalho. O atalho inicia o servidor e abre o navegador padrão em `http://localhost:3618`.

- Seu painel começa sem os registros do autor. Clique em **Registrar hoje** para começar.
- Mantenha a janela do servidor aberta durante o uso. Feche-a para desligá-lo.
- Nas próximas vezes, basta clicar no atalho; não precisa repetir a instalação.

### Atualizar uma instalação existente

Feche o servidor. Abra o terminal na pasta `build-in-public-16-18` e execute:

```powershell
git pull
cd habit-system
npm.cmd install
npm.cmd run setup:windows
```

O instalador preserva seu `.env.local` e recria o atalho. Se mover o repo de pasta, execute a configuração novamente no novo local.

## Começar no Linux com seus próprios dados

Com Node.js LTS e Git instalados:

```bash
git clone https://github.com/pedrohrdev/build-in-public-16-18.git
cd build-in-public-16-18/habit-system
npm install
mkdir -p "$HOME/.local/share/habitos/registros"
```

Crie o arquivo `.env.local` dentro de `habit-system` com o conteúdo abaixo. Substitua o caminho pelo caminho absoluto da sua pasta e o usuário pelo seu perfil:

```dotenv
LOGS_ROOT="/home/SEU_USUARIO/.local/share/habitos/registros"
GITHUB_USER="SEU_USUARIO_GITHUB"
```

Ainda dentro de `habit-system`, execute:

```bash
npm run dev -- --hostname 127.0.0.1
```

Abra `http://localhost:3618`. Para parar, pressione `Ctrl+C` no terminal. O instalador automático de atalho disponível no repo é para Windows; os detalhes do script de abertura para Linux estão no [README do aplicativo](habit-system/README.md).

## Sobre o projeto

Este repo reúne minha jornada pública de estudos, dos 16 aos 18 anos, e um sistema local para acompanhar hábitos. Comecei registrando meu progresso em Markdown e construí o painel para visualizar esse histórico. Você também pode usar o sistema com seus próprios registros.

O aplicativo fica em `habit-system/` e usa **Next.js, React e TypeScript**. Os registros ficam em arquivos `.md`, sem precisar configurar um banco de dados. O sistema roda no seu computador e abre no navegador.

## Funcionalidades

- **Hoje:** atividades do dia, sequência, médias e comparações com dias e semanas anteriores.
- **Mês:** calendário, horas de estudo, páginas lidas e histórico. Permite completar dias antigos e informar totais mensais.
- **Ano:** evolução anual, mapa de atividade e totais por mês.
- **Hábitos:** programação, inglês, leitura e atividade do seu perfil no GitHub.
- **Conquistas:** marcos do seu progresso.
- **Diário:** busca e consulta dos registros.
- **Dados:** relatório de leitura dos arquivos e resumos mensais.

## Seus dados e configurações

No Windows, o instalador configura estes locais:

| Local | Conteúdo |
| --- | --- |
| `%LOCALAPPDATA%\Habitos\registros` | Seus registros pessoais em Markdown |
| `habit-system/.env.local` | Caminho dos registros e seu usuário do GitHub |
| `habit-system/data/` | Cache e arquivos gerados pelo aplicativo |

Para abrir seus registros no Windows, pressione `Win+R`, cole `%LOCALAPPDATA%\Habitos\registros` e pressione Enter. Faça backup dessa pasta para preservar seu histórico.

O `.env.local` e a pasta `data/` são ignorados pelo Git. Os registros pessoais configurados pelo instalador ficam fora do repo. Instalações no mesmo usuário do Windows usam a mesma pasta pessoal por padrão; altere `LOGS_ROOT` se quiser históricos separados.

Os registros públicos do autor continuam nos arquivos clonados. **A configuração pessoal faz o painel ler sua própria pasta.** Sem `LOGS_ROOT`, o aplicativo lê os registros do repo; sem `GITHUB_USER`, usa `pedrohrdev`.

Se já existir um `.env.local`, o instalador não o sobrescreve. Confira as duas opções para garantir que apontam para seus dados, por exemplo:

```dotenv
LOGS_ROOT="C:/Users/SeuNome/AppData/Local/Habitos/registros"
GITHUB_USER="seu-usuario-github"
```

Reinicie o servidor depois de alterar configurações.

## Integração com o GitHub

O sistema consulta a atividade do perfil definido em `GITHUB_USER` e mantém cache por 30 minutos. Sem token, consulta os commits públicos. A instalação básica no Windows não exige GitHub CLI nem token.

Para consultas autenticadas, adicione seu próprio `GITHUB_TOKEN` ao `.env.local`. O acesso a informações privadas depende das permissões do token. Nunca coloque tokens em arquivos versionados.

## Problemas comuns no Windows

| Problema | Solução |
| --- | --- |
| `git` ou `npm.cmd` não é reconhecido | Instale Git e Node.js LTS, feche o terminal e abra outro. |
| PowerShell bloqueia `npm.ps1` | Use `npm.cmd`, como nos comandos acima. |
| Atalho aponta para uma pasta antiga | Execute `npm.cmd run setup:windows` dentro de `habit-system` novamente. |
| O painel não abre | Confira o erro na janela do servidor. Para iniciar manualmente, use `npm.cmd run dev -- --hostname 127.0.0.1` e abra `http://localhost:3618`. |
| Aparecem os registros do autor | Confira se `LOGS_ROOT` no `.env.local` aponta para sua pasta pessoal e reinicie o servidor. |
| Aparece o GitHub do autor | Defina seu perfil em `GITHUB_USER` no `.env.local` e reinicie o servidor. |

Mais detalhes sobre os formatos dos registros, importação e scripts estão no [README do aplicativo](habit-system/README.md).
