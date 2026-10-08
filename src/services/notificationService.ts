import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { type SQLiteDatabase } from 'expo-sqlite';

import { type Task } from '@/models/task';
import { setTaskNotificationId } from '@/repositories/taskRepository';
import { formatDateTimeLocal, isValidISO } from '@/utils/date';
import { errorMessage } from '@/utils/error';

export const ANDROID_CHANNEL_ID = 'task-reminders';
export const ANDROID_CHANNEL_NAME = 'Lembretes de tarefas';

export type SyncResult = {
  /** Id do agendamento criado agora, ou `null` quando nada foi agendado. */
  notificationId: string | null;
  /** Mensagem amigável quando algo falhou (permissão negada, data inválida, erro). */
  warning?: string;
  /** `true` quando a causa foi permissão negada (permite oferecer abrir configurações). */
  permissionDenied?: boolean;
};

export type SyncOptions = {
  /**
   * Pedir a permissão ao sistema se ainda não foi concedida.
   * Usada pelos fluxos com gesto do usuário (salvar tarefa com data futura,
   * reabrir tarefa) — nunca no boot, sem contexto.
   */
  requestPermission?: boolean;
};

/**
 * Configurado uma vez no `_layout.tsx`. Define o comportamento quando a
 * notificação chega com o app em primeiro plano (sem handler, nada é exibido).
 */
export function configureNotifications(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Plataforma sem suporte a notificações (ex.: web) — segue sem handler.
  }
}

/** Canal é obrigatório no Android: sem ele a notificação agendada não aparece. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: ANDROID_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3c87f7',
  });
}

async function ensurePermission(request: boolean | undefined): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!request || !current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

async function cancelById(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Agendamento já não existe (tarefa concluída/excluída em outro fluxo).
  }
}

/**
 * Cancela qualquer agendamento anterior e, se a tarefa estiver pendente com
 * data/hora **futura**, agenda o lembrete e persiste o novo `notificationId`
 * na linha da tarefa.
 *
 * Matriz de comportamento (AGENT_GUIDE fase 10):
 * - criada com data futura → agenda;
 * - data alterada → cancela a antiga e agenda a nova;
 * - data removida → cancela;
 * - concluída → cancela;
 * - reaberta com data futura → agenda de novo;
 * - data no passado → cancela qualquer uma e não agenda;
 * - permissão negada / erro → avisa sem derrubar o fluxo.
 */
export async function syncTaskNotification(
  db: SQLiteDatabase,
  task: Task,
  options: SyncOptions = {},
): Promise<SyncResult> {
  // Web não suporta notificações locais agendadas — não é um erro do usuário.
  if (Platform.OS === 'web') {
    await cancelById(task.notificationId);
    await setTaskNotificationId(db, task.id, null);
    return { notificationId: null };
  }

  await cancelById(task.notificationId);
  await setTaskNotificationId(db, task.id, null);

  if (task.completed) return { notificationId: null };
  if (task.dueDateTime == null) return { notificationId: null };

  if (!isValidISO(task.dueDateTime)) {
    return {
      notificationId: null,
      warning: 'Data de vencimento inválida: o lembrete não foi agendado.',
    };
  }

  const date = new Date(task.dueDateTime);
  if (date.getTime() <= Date.now()) {
    // Data no passado: nada a agendar (o cancelamento acima já cobre o resto).
    return { notificationId: null };
  }

  const granted = await ensurePermission(options.requestPermission);
  if (!granted) {
    return {
      notificationId: null,
      permissionDenied: true,
      warning:
        'Permissão de notificação negada: a tarefa foi salva, mas o lembrete não foi agendado.',
    };
  }

  try {
    await ensureAndroidChannel();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Task reminder: ${task.title}`,
        body: formatDateTimeLocal(task.dueDateTime) ?? undefined,
        data: { taskId: task.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    await setTaskNotificationId(db, task.id, notificationId);
    return { notificationId };
  } catch (e) {
    return {
      notificationId: null,
      warning: errorMessage(e, 'Não foi possível agendar o lembrete da tarefa.'),
    };
  }
}

/**
 * Cancela o agendamento da tarefa e zera `notificationId` — usado na exclusão
 * (a linha é removida logo em seguida, o UPDATE é inofensivo).
 */
export async function cancelTaskNotification(
  db: SQLiteDatabase,
  task: Pick<Task, 'id' | 'notificationId'>,
): Promise<void> {
  await cancelById(task.notificationId);
  if (Platform.OS !== 'web') {
    await setTaskNotificationId(db, task.id, null);
  }
}
