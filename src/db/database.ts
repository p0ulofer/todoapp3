import { type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

export const DATABASE_NAME = 'todoapp3.db';

/**
 * Executado pelo `SQLiteProvider` (prop `onInit`) logo depois de abrir a conexão.
 * `PRAGMA foreign_keys` é por conexão e não é persistido no arquivo do banco,
 * por isso precisa ser aplicado a cada abertura — aqui o provider mantém uma
 * única conexão durante a vida do app.
 */
export async function onInitDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
}
