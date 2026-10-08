export interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  /** ISO 8601 UTC (texto) ou null quando não há vencimento. */
  dueDateTime: string | null;
  /** ISO 8601 UTC (texto). */
  createdAt: string;
  categoryId: number | null;
  /** Id retornado pelo expo-notifications ao agendar o lembrete desta tarefa. */
  notificationId: string | null;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  completed?: boolean;
  dueDateTime?: string | null;
  categoryId?: number | null;
  notificationId?: string | null;
}

/** Forma bruta retornada pelo SQLite (colunas como estão no banco). */
export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  completed: number;
  dueDateTime: string | null;
  createdAt: string;
  categoryId: number | null;
  notificationId: string | null;
}
