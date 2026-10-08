import { type SQLiteDatabase } from 'expo-sqlite';

import { type Task, type TaskInput, type TaskRow } from '@/models/task';

const BASE_SELECT = `
  SELECT id, title, description, completed, dueDateTime, createdAt, categoryId, notificationId
  FROM tasks
`;

/**
 * Ordenação única para a lista: pendentes primeiro, depois as que têm vencimento
 * mais próximo (sem vencimento por último — ISO 8601 em texto ordena
 * cronologicamente), e por fim as mais recentes (createdAt DESC).
 */
const BASE_ORDER_BY = `
  ORDER BY completed ASC,
           CASE WHEN dueDateTime IS NULL THEN 1 ELSE 0 END ASC,
           dueDateTime ASC,
           createdAt DESC
`;

export type TaskStatusFilter = 'all' | 'pending' | 'completed';

export type TaskFilters = {
  /** `all` (padrão) | `pending` | `completed`. */
  status?: TaskStatusFilter;
  /**
   * `undefined` = todas as categorias; `null` = apenas tarefas sem categoria;
   * número = apenas aquela categoria.
   */
  categoryId?: number | null;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    completed: row.completed === 1,
    dueDateTime: row.dueDateTime ?? null,
    createdAt: row.createdAt,
    categoryId: row.categoryId ?? null,
    notificationId: row.notificationId ?? null,
  };
}

function requireTitle(title: string | null | undefined): string {
  const trimmed = (title ?? '').trim();
  if (trimmed.length === 0) {
    throw new Error('O título da tarefa é obrigatório.');
  }
  return trimmed;
}

export async function listTasks(db: SQLiteDatabase, filters: TaskFilters = {}): Promise<Task[]> {
  const clauses: string[] = [];
  const params: (number | string)[] = [];

  if (filters.status === 'pending') {
    clauses.push('completed = 0');
  } else if (filters.status === 'completed') {
    clauses.push('completed = 1');
  }

  if (filters.categoryId === null) {
    clauses.push('categoryId IS NULL');
  } else if (typeof filters.categoryId === 'number') {
    clauses.push('categoryId = ?');
    params.push(filters.categoryId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.getAllAsync<TaskRow>(
    `${BASE_SELECT} ${where} ${BASE_ORDER_BY}`,
    ...params,
  );
  return rows.map(toTask);
}

export async function getTaskById(db: SQLiteDatabase, id: number): Promise<Task | null> {
  const row = await db.getFirstAsync<TaskRow>(`${BASE_SELECT} WHERE id = ?`, id);
  return row ? toTask(row) : null;
}

export async function createTask(db: SQLiteDatabase, input: TaskInput): Promise<Task> {
  const title = requireTitle(input.title);
  const createdAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO tasks (title, description, completed, dueDateTime, createdAt, categoryId, notificationId)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    title,
    input.description?.trim() || null,
    input.completed ? 1 : 0,
    input.dueDateTime ?? null,
    createdAt,
    input.categoryId ?? null,
    input.notificationId ?? null,
  );

  const created = await getTaskById(db, result.lastInsertRowId);
  if (!created) {
    throw new Error('Falha ao ler a tarefa recém-criada.');
  }
  return created;
}

export async function updateTask(
  db: SQLiteDatabase,
  id: number,
  input: TaskInput,
): Promise<Task | null> {
  const title = requireTitle(input.title);

  await db.runAsync(
    `UPDATE tasks
       SET title = ?, description = ?, completed = ?, dueDateTime = ?, categoryId = ?, notificationId = ?
     WHERE id = ?`,
    title,
    input.description?.trim() || null,
    input.completed ? 1 : 0,
    input.dueDateTime ?? null,
    input.categoryId ?? null,
    input.notificationId ?? null,
    id,
  );

  return getTaskById(db, id);
}

export async function deleteTask(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
  return result.changes > 0;
}

export async function setTaskNotificationId(
  db: SQLiteDatabase,
  id: number,
  notificationId: string | null,
): Promise<void> {
  await db.runAsync('UPDATE tasks SET notificationId = ? WHERE id = ?', notificationId, id);
}
