# AGENT_GUIDE.md — Passo a passo para implementar o Mobile To-Do (Expo + React Native)

> **Como usar:** coloque este arquivo e a especificação original (`SPEC.md`) na raiz da pasta do projeto, abra o coding agent (Claude Code, Cursor, Copilot Agent, etc.) e diga:
> *"Leia `SPEC.md` e `AGENT_GUIDE.md`. Execute o guia fase por fase, na ordem. Ao terminar cada fase, atualize o `BUILD_LOG.md`, rode as validações e faça um commit. Só avance para a próxima fase depois que eu disser `próxima`."*
>
> Regra da atividade: **o humano não escreve código**. Tudo é feito por prompts ao agent. Seu papel é guiar, validar e entender.

---

## 0. Regras permanentes para o agent (valem durante todo o projeto)

1. `SPEC.md` é a fonte de verdade. Em caso de dúvida, siga a spec.
2. Crie o `BUILD_LOG.md` **antes de qualquer outra coisa** e acrescente (append-only) uma entrada a cada decisão, mudança, erro ou correção. **Nunca reescreva entradas antigas.** Se uma decisão estava errada, crie uma nova entrada de correção.
3. Cada entrada do log segue o formato:
   ```
   ## [AAAA-MM-DD HH:mm] <título curto>
   ### Prompt / Request        (palavras originais do usuário)
   ### Decision Summary       (o que, bibliotecas, arquitetura, premissas, alternativas; só resumo, sem chain-of-thought)
   ### Actions Performed      (arquivos criados/alterados, dependências, schema)
   ### Result
   ### Problems / Errors
   ### Fixes Attempted        (inclusive tentativas que falharam)
   ### Current Status         (Completed | Partially completed | Broken | Needs testing | Blocked)
   ```
4. Registre no log **qual agent/modelo** está sendo usado e, se trocar de ferramenta, qual parte do projeto cada um fez (seção "Tools & Models" no topo do log, atualizada por novas entradas).
5. Use **TypeScript**. Prefira a documentação oficial atual do Expo (consulte `https://docs.expo.dev` antes de usar APIs de `expo-sqlite`, `expo-notifications` e `expo-router`, pois elas mudam entre SDKs). Não use API de memória se houver dúvida.
6. Não adicione bibliotecas desnecessárias. Para cada dependência importante, registre nome, propósito e motivo no log.
7. Valide continuamente: `npx tsc --noEmit`, `npx expo-doctor`, `npx expo lint` e execução real do app. Registre falhas e correções.
8. Commits pequenos e significativos (Conventional Commits, ex.: `feat: add task repository`). Um commit por fase, no mínimo. Inclua `BUILD_LOG.md` no mesmo commit da mudança correspondente.
9. Nada de complexidade arquitetural gratuita. É um app educacional pequeno.

---

## Fase 1 — Inicialização do projeto e BUILD_LOG

**Prompt sugerido ao agent:**
> Initialize an Expo + React Native + TypeScript project in this folder using the latest stable SDK and the default template with Expo Router. First create `BUILD_LOG.md` with a header, a "Tools & Models" section, and the first entry. Then initialize a git repository (if not already) with a proper `.gitignore`, and make the first commit.

**O agent deve:**
- Verificar versões: `node -v`, `npm -v`.
- Criar o projeto: `npx create-expo-app@latest . --template default` (ou template equivalente com Expo Router + TS). Remover telas de exemplo que não serão usadas.
- Criar `BUILD_LOG.md` (primeira entrada: setup, ferramenta/modelo usado, SDK escolhido, gerenciador de pacotes).
- `git init`, commit inicial: `chore: initialize expo project and build log`.

**Validação:** `npx expo start` abre sem erros; `npx tsc --noEmit` passa.

---

## Fase 2 — Dependências e estrutura de pastas

**Dependências esperadas (instalar sempre com `npx expo install` para versões compatíveis com o SDK):**

| Pacote | Propósito |
|---|---|
| `expo-router` | Navegação baseada em arquivos (já vem no template) |
| `expo-sqlite` | Persistência SQLite |
| `expo-notifications` | Notificações locais agendadas |
| `expo-device` | Checar se é dispositivo físico, quando relevante |
| `@react-native-community/datetimepicker` | Seleção de data e hora nativa |
| `expo-constants` | (opcional) metadados do app |

Evite ORMs. Use `expo-sqlite` direto com um repositório simples.

**Estrutura sugerida (feature-light, repository-based):**
```
app/
  _layout.tsx              # SQLiteProvider, providers de estado, configuração de notificações
  index.tsx                # Tela 1 — Task List
  task/[id].tsx            # Tela 2 — Task Editor/Detail ("new" para criação)
  categories.tsx           # Tela 3 — Category Management
src/
  db/
    database.ts            # abertura, migrações, PRAGMA foreign_keys = ON
    migrations.ts
  models/
    task.ts
    category.ts
  repositories/
    taskRepository.ts
    categoryRepository.ts
  services/
    notificationService.ts # permissão, canal Android, schedule/cancel/reschedule
  state/
    AppDataContext.tsx     # (ou hooks) estado + refresh
  components/
    TaskItem.tsx
    FilterBar.tsx
    CategoryPicker.tsx
    DateTimeField.tsx
  utils/
    date.ts
```

**Prompt sugerido:**
> Install the dependencies listed in AGENT_GUIDE.md phase 2 using `npx expo install`, create the folder structure, and log each dependency (name, purpose, reason) in BUILD_LOG.md. Configure `app.json` plugins for `expo-sqlite` and `expo-notifications` as required by the docs.

**Validação:** projeto compila; commit `chore: add dependencies and folder structure`.

---

## Fase 3 — Navegação básica (3 telas)

**Prompt sugerido:**
> Create the three screens as simple placeholders and wire navigation: Task List → Task Editor (new and existing), Task List → Category Management. Use Expo Router with a Stack navigator and proper headers/titles. For editing an existing task, pass only the task ID as a route param (`/task/[id]`, with `new` for creation) and let the editor load the task from SQLite. Document this strategy and the alternatives considered in BUILD_LOG.md.

**Decisão a registrar:** passar apenas o `id` evita dados desatualizados e garante que o editor sempre leia a fonte de verdade (SQLite). Alternativas: objeto completo na rota (pode ficar obsoleto), estado global compartilhado.

**Validação:** navegar entre as três telas e voltar. Commit: `feat: basic navigation`.

---

## Fase 4 — Modelos e SQLite

**Schema esperado:**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  dueDateTime TEXT,              -- ISO 8601 UTC, nullable
  createdAt TEXT NOT NULL,       -- ISO 8601 UTC
  categoryId INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  notificationId TEXT            -- campo extra: id da notificação agendada
);
```

**Pontos importantes:**
- Habilitar `PRAGMA foreign_keys = ON` a cada conexão (SQLite não habilita por padrão).
- Versionar o schema com `PRAGMA user_version` e migrações incrementais (padrão da doc do `expo-sqlite`, usando `SQLiteProvider` + `onInit`).
- Datas armazenadas em ISO 8601 (UTC) como texto; converter para `Date` apenas na UI.
- Campos extras (`notificationId`, `color`) devem ser documentados no log.
- Categorias iniciais (opcional): Personal, Work, Study, Shopping, inseridas apenas na primeira migração.

**Prompt sugerido:**
> Implement the SQLite layer with `expo-sqlite` using `SQLiteProvider` and a versioned migration (`PRAGMA user_version`). Create the TypeScript models and the `taskRepository` and `categoryRepository` with full CRUD using parameterized queries (never string concatenation). Enable foreign keys. Document the SQLite approach, the extra fields (`notificationId`, `color`) and the category-deletion behavior (tasks become uncategorized via `ON DELETE SET NULL`) in BUILD_LOG.md.

**Validação:** o app abre, cria o banco e não gera erro; `tsc` passa. Commit: `feat: sqlite schema, models and repositories`.

---

## Fase 5 — CRUD de tarefas conectado à UI

**Prompt sugerido:**
> Implement task creation, editing, deletion and complete/reopen, connected to the repositories. The editor must validate the title (required, trimmed, non-empty), populate the form when editing, and provide Save, Cancel and Delete (with confirmation) buttons. On the list, tapping the item opens the editor and a checkbox/button toggles completed/pending. Show user feedback (Alert/toast/inline message) on validation and database errors, wrapping repository calls in try/catch.

**Pontos de atenção:**
- Teclado não deve cobrir os campos (`KeyboardAvoidingView`/`ScrollView`).
- Evitar duplo toque em "Salvar" (estado `saving`).

**Validação manual:** criar, editar, excluir, concluir, reabrir. Commit: `feat: task CRUD`.

---

## Fase 6 — CRUD de categorias

**Prompt sugerido:**
> Implement the Category Management screen: list, create, rename (inline or modal) and delete categories. Validate empty and duplicate names with friendly messages. When deleting a category used by tasks, show a confirmation that states how many tasks will become uncategorized, then delete. Add the CategoryPicker to the task editor (with an optional "No category" choice).

**Validação:** apagar categoria em uso → tarefas ficam sem categoria, sem crash. Commit: `feat: category CRUD`.

---

## Fase 7 — Estado e atualização da UI

**Estratégia sugerida (simples e adequada):** repositórios + hook/Context com contador de versão (`refresh()`), e `useFocusEffect` na lista para recarregar ao voltar das outras telas. Alternativa: `useSQLiteContext` + `addDatabaseChangeListener` do `expo-sqlite`. Registre a escolha e o motivo.

**Prompt sugerido:**
> Implement the state-management strategy: after any create/update/delete/complete/category change, the Task List and category lists must refresh automatically. Use React Context + hooks with a refresh mechanism and `useFocusEffect` (or the expo-sqlite change listener if you judge it better). Document the choice and alternatives in BUILD_LOG.md.

**Validação:** criar tarefa → voltar → aparece sem recarregar manualmente; renomear categoria → lista reflete o novo nome. Commit: `feat: state management and refresh`.

---

## Fase 8 — Filtros

**Estratégia sugerida:** filtros via query SQL com `WHERE` dinâmico e parâmetros (status + categoria combinados), executados novamente quando o filtro muda. Alternativa: filtrar em memória. Registre a decisão.

**UI:** chips ou segmented control: `All | Pending | Completed`, e uma linha de chips de categorias (com "All categories" e talvez "Uncategorized").

**Prompt sugerido:**
> Implement status filtering (All/Pending/Completed) and category filtering on the Task List, combined (AND). Use SQL queries with parameters. Show an empty-state message when no tasks match. Ordering: pending first, then by dueDateTime ascending (nulls last), then createdAt descending. Document the approach.

**Validação:** combinações de filtros retornam o esperado. Commit: `feat: status and category filters`.

---

## Fase 9 — Due date e hora

**Prompt sugerido:**
> Add optional due date and time to the editor using `@react-native-community/datetimepicker` (separate date and time selection, with a "Clear" button). Combine into a single Date stored as ISO. Show the due date/time on each task in the list, highlighting overdue pending tasks. Handle invalid dates gracefully. Allow saving tasks without due date.

**Pontos de atenção:**
- Android: picker em modo `date` e depois `time` (dois passos); iOS: pode usar `datetime`.
- Permitir salvar com data no passado? Decida e registre (sugestão: permitir, mas sem agendar notificação e com aviso).

Commit: `feat: due date and time`.

---

## Fase 10 — Notificações locais

**Estratégia:** guardar o `notificationId` retornado pelo agendamento na coluna `notificationId` da tarefa.

**Pontos técnicos (confirmar na doc atual):**
- `Notifications.setNotificationHandler` configurado no `_layout.tsx` (para mostrar alerta com app em primeiro plano).
- **Android:** criar um canal (`setNotificationChannelAsync`) antes de agendar; Android 13+ exige a permissão `POST_NOTIFICATIONS`.
- Trigger por data usando o formato atual do SDK (`type: Notifications.SchedulableTriggerInputTypes.DATE`, `date`) e `channelId` no Android.
- Conteúdo: `Task reminder: <title>`; incluir o `taskId` em `data`.
- **Expo Go pode ter limitações com notificações em certos SDKs/plataformas.** Se não funcionar, o agent deve criar um *development build* (`npx expo run:android` ou EAS Build) e registrar isso no log como problema + solução.

**Matriz de comportamento obrigatória (implementar em uma função central `syncTaskNotification(task)` no `notificationService`):**

| Evento | Ação |
|---|---|
| Criada com data futura | Agenda e salva `notificationId` |
| Data alterada | Cancela a antiga, agenda a nova, atualiza `notificationId` |
| Data removida | Cancela e zera `notificationId` |
| Tarefa concluída | Cancela e zera `notificationId` |
| Concluída → pendente, data ainda futura | Agenda novamente |
| Tarefa excluída | Cancela |
| Data no passado | Não agenda (e cancela qualquer existente) |

**Permissões:**
- Solicitar permissão no momento apropriado (ao salvar primeira tarefa com data, não no boot sem contexto).
- Se negada: salvar a tarefa normalmente, mostrar aviso amigável (com opção de abrir as configurações), nunca crashar.
- Tratar erros de agendamento com try/catch e feedback ao usuário.

**Prompt sugerido:**
> Implement local notifications following the behavior matrix in AGENT_GUIDE.md phase 10. Create a central `notificationService` with permission handling, the Android channel, schedule, cancel and a `syncTaskNotification` function used by every create/update/complete/reopen/delete flow. Store the `notificationId` in the task row. Handle permission denial and scheduling errors gracefully. Check the current expo-notifications docs for the trigger format. Document strategy, permission decisions and any Expo Go limitation in BUILD_LOG.md.

Commit: `feat: local notifications`.

---

## Fase 11 — Tratamento de erros e polimento mínimo

**Prompt sugerido:**
> Review error handling across the app: invalid title, SQLite errors, invalid dates, permission denial, scheduling errors. Make sure nothing crashes and the user gets feedback. Add empty states, loading indicators and basic consistent styling (spacing, colors, touch targets). Do not spend effort on advanced visual polish.

Commit: `fix: error handling and ui consistency`.

---

## Fase 12 — Validação completa

O agent deve rodar:
```bash
npx tsc --noEmit
npx expo-doctor
npx expo lint
```
E o humano testa no emulador/dispositivo (o agent deve gerar um roteiro em `TEST_PLAN.md`).

**Roteiro de testes manuais mínimo:**
1. Criar tarefa sem data → aparece na lista.
2. Criar tarefa com data daqui a 1–2 minutos → notificação chega.
3. Editar a data → a antiga não dispara; a nova dispara.
4. Remover a data → nada dispara.
5. Concluir a tarefa antes do horário → nada dispara.
6. Reabrir a tarefa (data ainda futura) → volta a agendar.
7. Excluir a tarefa → nada dispara.
8. Negar a permissão → app não crasha, aviso exibido.
9. Criar/renomear/excluir categorias; excluir categoria em uso.
10. Filtros por status e categoria, isolados e combinados.
11. Fechar o app (swipe) e reabrir → dados continuam.
12. Reiniciar emulador/dispositivo → dados continuam.

Registre cada falha encontrada em `BUILD_LOG.md` (Problems / Fixes) e corrija em entradas novas. Commits: `fix: ...` por problema relevante.

---

## Fase 13 — Documentação e revisão final

**Prompt sugerido:**
> Create `README.md` with prerequisites, install, how to run (Expo Go and/or development build for Android/iOS), project structure, and known limitations. Review the functional acceptance criteria checklist from SPEC.md section 20 and mark each item as passed/failed/partial with evidence in BUILD_LOG.md. Then append a final entry with a concise summary: architecture, dependencies, SQLite strategy, state-management strategy, navigation strategy, notification strategy, known limitations and remaining bugs. Do not edit previous log entries.

Commit: `docs: readme and final review`.

---

## Fase 14 — Questionário

O questionário **não está incluso na especificação**. Cole-o para o agent e instrua:

> Here is the questionnaire for the activity. Answer it in `QUESTIONNAIRE.md` based strictly on this project's real code and `BUILD_LOG.md` and git history. Cite file paths and commit hashes as evidence. Do not invent details; if something did not happen, say so. Include which decisions were made by the agent versus guided by me, which problems occurred and how they were solved.

Commit: `docs: add completed questionnaire`.

**Seu papel como humano:** leia o código gerado, peça ao agent para explicar trechos que você não entendeu (isso pode ser registrado no log) e confira se as respostas correspondem ao que realmente aconteceu.

---

## Fase 15 — Publicação no GitHub

1. Criar repositório no GitHub (pode pedir ao agent com `gh repo create` se o GitHub CLI estiver instalado, ou criar manualmente e pedir ao agent para configurar o remote).
2. `git remote add origin <url>` e `git push -u origin main`.
3. Conferir que o repositório contém: código-fonte, `BUILD_LOG.md`, `QUESTIONNAIRE.md`, `README.md`, `TEST_PLAN.md`, histórico de commits.
4. Garantir que `node_modules/`, `.expo/` e arquivos sensíveis não foram commitados.

---

## Armadilhas comuns (o agent deve verificar)

- Usar API antiga do `expo-sqlite` (versões legadas) em vez da API atual (`SQLiteProvider`, `getAllAsync`, `runAsync`, `getFirstAsync`, `withTransactionAsync`).
- Esquecer `PRAGMA foreign_keys = ON` → exclusão de categoria não zera `categoryId`.
- Esquecer o canal de notificações no Android → notificações não aparecem.
- Formato antigo de trigger de notificação (apenas `date` sem `type`) em SDKs recentes.
- Agendar notificação com data no passado (dispara imediatamente ou gera erro).
- Esquecer de cancelar a notificação ao concluir/excluir/alterar data.
- Não recarregar a lista ao voltar do editor.
- Timezone: salvar sempre em ISO UTC e exibir em horário local.
- Booleans no SQLite: armazenados como 0/1, converter nos models.
- Instalar pacotes com `npm install` em vez de `npx expo install` (versões incompatíveis).

---

## Checklist final de entrega

- [ ] App compila e inicia
- [ ] Todos os itens da seção 20 da spec verificados e registrados
- [ ] `BUILD_LOG.md` completo, append-only, com ferramentas/modelos usados
- [ ] `QUESTIONNAIRE.md` respondido com base no projeto real
- [ ] `README.md` com instruções de execução
- [ ] Histórico de commits significativo
- [ ] Repositório publicado no GitHub
- [ ] Você consegue explicar a arquitetura, as decisões do agent, os problemas e as correções
