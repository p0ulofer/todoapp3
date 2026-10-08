# Mobile To-Do (Expo + React Native + TypeScript)

App de tarefas com SQLite local, categorias, filtros, vencimento com data/hora e
lembretes por notificação local. Especificação: [`SPEC.md`](./SPEC.md) ·
Histórico de desenvolvimento: [`BUILD_LOG.md`](./BUILD_LOG.md) ·
Roteiro de testes manuais: [`TEST_PLAN.md`](./TEST_PLAN.md).

## Pré-requisitos

- **Node.js 20+** e npm
- **Expo Go** no celular (Android/iOS) — ou um development build
- (Opcional) Android SDK para emulador: `npx expo run:android`

## Instalação e execução

```bash
npm install        # dependências
npx expo start     # dev server (mostra QR code para o Expo Go)
```

Outros comandos úteis:

```bash
npx expo start --android   # abre no emulador/dispositivo conectado
npx expo start --web      # versão web no navegador
npx expo lint             # lint
npx tsc --noEmit          # checagem de tipos
npx expo-doctor           # saúde do projeto
```

> **Notificações:** exigem Android/iOS (o app web ignora o agendamento de propósito,
> porque `expo-notifications` não agenda notificações locais no navegador). No
> primeiro salvamento de uma tarefa com data futura o app pede a permissão.

### Development build (opcional)

Se algum módulo nativo precisar sair do Expo Go:

```bash
npx expo run:android   # ou: npx expo run:ios
# alternativa em nuvem: npx eas-cli build
```

## Estrutura do projeto

```
src/
  app/                 # rotas (Expo Router) — cada arquivo é uma tela
    _layout.tsx        # providers (SQLite, dados da app) + Stack + handler de notificações
    index.tsx          # 1. Lista de tarefas (filtros, vencimento, avisos)
    task/[id].tsx      # 2. Editor (new = criar, [id] = editar)
    categories.tsx     # 3. Gestão de categorias
  components/          # UI reutilizável (TaskItem, Chip, CategoryPicker, DueDateTimeField…)
  db/                  # conexão (WAL, foreign_keys) e migrações versionadas
  models/              # tipos Task/Category e suas formas brutas do banco
  repositories/        # acesso ao SQLite (queries parametrizadas)
  services/            # notificações locais (agendar/cancelar/sincronizar)
  state/               # AppDataContext (contador de versão + avisos)
  utils/               # data/hora (ISO UTC → local) e mensagens de erro
```

## Estratégias (resumo)

- **Persistência:** SQLite (`expo-sqlite`) com `SQLiteProvider`, `PRAGMA journal_mode=WAL`
  e `PRAGMA foreign_keys=ON` a cada conexão; esquema em migrações versionadas por
  `PRAGMA user_version`. Datas em **ISO 8601 UTC**, exibição em horário local;
  `completed` como 0/1 no banco e booleano nos repositórios; categorias com
  `ON DELETE SET NULL`.
- **Estado/UI:** os dados-fonte são as consultas ao SQLite. `AppDataContext` guarda um
  **contador de versão**; toda escrita chama `refresh()` e as telas leitoras recarregam
  com `useAppDataEffect` (foco + mudança de versão).
- **Navegação:** Expo Router; o editor recebe **apenas o id** (`/task/new` para criar,
  `/task/[id]` para editar).
- **Filtros:** `WHERE` dinâmico com parâmetros no SQL (status + categoria com `AND`),
  ordenação pendentes → vencimento crescente → mais recentes.
- **Notificações:** `src/services/notificationService.ts` centraliza canal Android,
  permissão, cancelar/agendar e o `syncTaskNotification` usado por criar, editar,
  concluir, reabrir e excluir; o `notificationId` fica na própria linha da tarefa.

## Limitações conhecidas

- Sem emulador/navegador no ambiente de desenvolvimento: as validações automáticas
  (tipo, lint, doctor, bundles web/android) passaram, mas o roteiro manual do
  `TEST_PLAN.md` ainda precisa ser executado por uma pessoa.
- A versão web não agenda notificações locais (limitação do `expo-notifications`).
- No web o campo de vencimento usa texto `AAAA-MM-DD HH:MM` em vez do seletor nativo.
- `Expo Go` pode ter limitações com notificações dependendo da versão/SDK; se o
  lembrete não chegar, use um development build (`npx expo run:android`).
- Sem testes automatizados (o projeto não exige framework de testes).
