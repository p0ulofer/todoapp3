import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Aviso transitório mostrado na lista (ex.: permissão de notificação negada). */
export type AppNotice = {
  message: string;
  /** Oferece o botão "Abrir configurações" quando a causa foi permissão negada. */
  canOpenSettings?: boolean;
} | null;

type AppDataContextValue = {
  /** Contador de versão: incrementa a cada mutação (create/update/delete). */
  version: number;
  /** Chame depois de qualquer escrita no banco para avisar as telas leitoras. */
  refresh: () => void;
  /** Aviso para exibir na tela inicial (quem grava define, a lista exibe e limpa). */
  notice: AppNotice;
  setNotice: (notice: AppNotice) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<AppNotice>(null);

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({ version, refresh, notice, setNotice }),
    [version, refresh, notice],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (context == null) {
    throw new Error('useAppData deve ser usado dentro de <AppDataProvider>.');
  }
  return context;
}

/**
 * Recarrega os dados da tela quando ela ganha foco **ou** quando `refresh()`
 * é chamado por qualquer tela (mudança de `version` muda a identidade do
 * callback e o `useFocusEffect` reexecuta — só se a tela estiver em foco;
 * em segundo plano ela recarrega ao voltar o foco).
 */
export function useAppDataEffect(load: () => void | Promise<void>): void {
  const { version } = useAppData();

  useFocusEffect(
    useCallback(() => {
      void load();
      // `version` não é lido no corpo: está aqui de propósito para mudar a
      // identidade do callback e reexecutar o efeito quando refresh() muda o contador.
    }, [load, version]), // eslint-disable-line react-hooks/exhaustive-deps
  );
}
