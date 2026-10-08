export interface Category {
  id: number;
  name: string;
  color: string | null;
}

export interface CategoryInput {
  name: string;
  color?: string | null;
}

/** Forma bruta retornada pelo SQLite (colunas como estão no banco). */
export interface CategoryRow {
  id: number;
  name: string;
  color: string | null;
}
