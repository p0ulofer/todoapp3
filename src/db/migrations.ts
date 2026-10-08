import { type SQLiteDatabase } from 'expo-sqlite';

export type Migration = {
  version: number;
  migrate: (db: SQLiteDatabase) => Promise<void>;
};

export const migrations: Migration[] = [
  {
    version: 1,
    async migrate(db) {
      await db.execAsync(`
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
          dueDateTime TEXT,
          createdAt TEXT NOT NULL,
          categoryId INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          notificationId TEXT
        );
      `);

      const seedCategories = ['Personal', 'Work', 'Study', 'Shopping'];
      for (const name of seedCategories) {
        await db.runAsync('INSERT OR IGNORE INTO categories (name) VALUES (?)', name);
      }
    },
  },
];

export const LATEST_DB_VERSION = migrations[migrations.length - 1]?.version ?? 0;

/**
 * Migrações incrementais versionadas com `PRAGMA user_version`
 * (padrão sugerido pela documentação do expo-sqlite).
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await db.withTransactionAsync(async () => {
      await migration.migrate(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      currentVersion = migration.version;
    });
  }
}
