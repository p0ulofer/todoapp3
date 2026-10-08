/**
 * Utilidades de data/hora.
 *
 * Regra do projeto: o banco guarda **ISO 8601 UTC** (`2026-10-08T15:30:00.000Z`);
 * a exibição é sempre no **horário local** do aparelho.
 */

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

/** `true` quando a string é ISO 8601 que o `Date` consegue interpretar. */
export function isValidISO(value: string | null | undefined): value is string {
  if (value == null || value.length === 0) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** ISO UTC → `dd/mm/aaaa, hh:mm` local (ou `null` se a data for inválida). */
export function formatDateTimeLocal(iso: string | null | undefined): string | null {
  if (!isValidISO(iso)) return null;
  return dateTimeFormatter.format(new Date(iso));
}

/** ISO UTC → `dd/mm/aaaa` local (ou `null`). */
export function formatDateLocal(iso: string | null | undefined): string | null {
  if (!isValidISO(iso)) return null;
  return dateFormatter.format(new Date(iso));
}

/** ISO UTC → `hh:mm` local (ou `null`). */
export function formatTimeLocal(iso: string | null | undefined): string | null {
  if (!isValidISO(iso)) return null;
  return timeFormatter.format(new Date(iso));
}

/**
 * Tarefa vencida: tem vencimento no passado e ainda está pendente.
 * Data inválida nunca conta como vencida.
 */
export function isOverdue(dueDateTime: string | null | undefined, completed: boolean): boolean {
  if (completed || !isValidISO(dueDateTime)) return false;
  return new Date(dueDateTime).getTime() < Date.now();
}

/** ISO UTC → `Date` local, ou `null` se inválida. */
export function toDate(iso: string | null | undefined): Date | null {
  if (!isValidISO(iso)) return null;
  return new Date(iso);
}

/** `Date` → ISO 8601 UTC para persistir no banco. */
export function toISO(date: Date): string {
  return date.toISOString();
}
