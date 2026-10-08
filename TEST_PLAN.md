# TEST_PLAN.md — Roteiro de testes manuais (Mobile To-Do)

Este roteiro é a **Fase 12** do `AGENT_GUIDE.md`. O agente não tem emulador, AVD ou
navegador neste ambiente, então os passos abaixo precisam ser executados **por uma
pessoa**, em dispositivo físico (Expo Go) ou emulador.

Antes de começar:

```bash
npx expo start          # mostra o QR code
# aponte o Expo Go (Android) ou a câmera (iOS) para o QR code
```

> Nota: notificações locais **não funcionam no navegador** (a versão web do app
> ignora o agendamento de propósito). Teste as notificações em Android/iOS.

Para reexecutar as validações automáticas a qualquer momento:

```bash
npx tsc --noEmit      # checagem de tipos
npx expo lint         # lint
npx expo-doctor       # saúde do projeto
npx expo export --platform web      # bundle web
npx expo export --platform android  # bundle Android (Hermes)
```

## Roteiro

Cada passo tem o **resultado esperado**. Registre qualquer desvio em
`BUILD_LOG.md` (seção *Problems / Errors*) antes de corrigir.

| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Criar tarefa **sem** data (título só) | Aparece na lista com “Pendente”, sem linha de vencimento |
| 2 | Criar tarefa com vencimento em **1–2 minutos** | Salva e, ao chegar a hora, a notificação aparece com `Task reminder: <título>` |
| 3 | Editar a tarefa do passo 2 trocando a data | A notificação antiga **não** dispara; a nova dispara |
| 4 | Remover a data (“Limpar”) e salvar | Nada dispara; o item volta a não mostrar vencimento |
| 5 | Concluir a tarefa **antes** do horário | O lembrete é cancelado (nada dispara) |
| 6 | Reabrir a tarefa (voltar para pendente) com data ainda futura | O lembrete volta a ser agendado |
| 7 | Excluir a tarefa | O lembrete é cancelado; nada dispara |
| 8 | Negar a permissão de notificação ao salvar | A tarefa é salva normalmente; aviso aparece na lista com **Abrir configurações**; app não trava |
| 9 | Criar, renomear e excluir categorias; excluir categoria em uso | Contagem correta; tarefas da categoria excluída ficam **sem categoria** (aviso antes de confirmar) |
| 10 | Filtros por status e por categoria (isolados e combinados) | Lista muda conforme o chip; combinados usam AND; sem resultado mostra “Limpar filtros” |
| 11 | Fechar o app (swipe) e reabrir | Tarefas, categorias e filtros continuam (SQLite) |
| 12 | Reiniciar o emulador/dispositivo | Os dados continuam (arquivo `.db` persiste) |

## Complementos rápidos

- **Vencida:** deixe uma tarefa pendente com data no passado → o item aparece em
  vermelho com “Vencida: dd/mm/aaaa, hh:mm”.
- **Ordem da lista:** pendentes primeiro, vencimento mais próximo primeiro, sem
  vencimento no fim de cada grupo, concluídas por último.
- **Navegação:** lista → editor (nova/existente) → categorias → volta; use
  Salvar, Cancelar e Excluir (confirmação inline).
- **Título vazio:** salvar sem título mostra “O título é obrigatório.”
- **Data inválida (web):** em `http://localhost:8081`, digite uma data fora do
  formato `AAAA-MM-DD HH:MM` → aparece aviso e o valor não é gravado.

## Checklist rápido (SPEC seção 20)

- [ ] app compila e inicia
- [ ] criar / editar / excluir tarefa
- [ ] concluir e reabrir tarefa
- [ ] dados persistem após reiniciar
- [ ] criar / renomear / excluir categorias
- [ ] tarefa opcionalmente ligada a categoria
- [ ] filtro de status e de categoria funcionam
- [ ] navegação entre as 3 telas
- [ ] data/hora de vencimento opcional
- [ ] notificação local agendada, atualizada, cancelada ao concluir/excluir
- [ ] permissão tratada sem crash
- [ ] `BUILD_LOG.md` completo
