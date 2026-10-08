import { type SQLiteDatabase } from 'expo-sqlite';

import { type Category, type CategoryInput, type CategoryRow } from '@/models/category';

const BASE_SELECT = 'SELECT id, name, color FROM categories';

function requireName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) {
    throw new Error('O nome da categoria é obrigatório.');
  }
  return trimmed;
}

async function nameExists(db: SQLiteDatabase, name: string, exceptId?: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: number }>(
    `${BASE_SELECT} WHERE name = ? COLLATE NOCASE AND id != ?`,
    name,
    exceptId ?? -1,
  );
  return row != null;
}

export async function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(`${BASE_SELECT} ORDER BY name COLLATE NOCASE`);
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color ?? null }));
}

export async function getCategoryById(db: SQLiteDatabase, id: number): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>(`${BASE_SELECT} WHERE id = ?`, id);
  return row ? { id: row.id, name: row.name, color: row.color ?? null } : null;
}

export async function createCategory(
  db: SQLiteDatabase,
  input: CategoryInput,
): Promise<Category> {
  const name = requireName(input.name);

  if (await nameExists(db, name)) {
    throw new Error('Já existe uma categoria com esse nome.');
  }

  const result = await db.runAsync('INSERT INTO categories (name, color) VALUES (?, ?)', name, input.color ?? null);

  const created = await getCategoryById(db, result.lastInsertRowId);
  if (!created) {
    throw new Error('Falha ao ler a categoria recém-criada.');
  }
  return created;
}

export async function renameCategory(
  db: SQLiteDatabase,
  id: number,
  name: string,
): Promise<Category> {
  const trimmed = requireName(name);

  if (await nameExists(db, trimmed, id)) {
    throw new Error('Já existe uma categoria com esse nome.');
  }

  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', trimmed, id);

  const updated = await getCategoryById(db, id);
  if (!updated) {
    throw new Error('Categoria não encontrada.');
  }
  return updated;
}

export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  return result.changes > 0;
}

export async function countTasksPerCategory(
  db: SQLiteDatabase,
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ categoryId: number; count: number }>(
    'SELECT categoryId, COUNT(*) AS count FROM tasks GROUP BY categoryId',
  );
  const counts: Record<number, number> = {};
  for (const row of rows) {
    if (row.categoryId != null) {
      counts[row.categoryId] = row.count;
    }
  }
  return counts;
}
