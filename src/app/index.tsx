import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { Chip } from '@/components/Chip';
import { TaskItem } from '@/components/TaskItem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Category } from '@/models/category';
import { type Task } from '@/models/task';
import { listCategories } from '@/repositories/categoryRepository';
import { listTasks, updateTask, type TaskStatusFilter } from '@/repositories/taskRepository';
import { syncTaskNotification } from '@/services/notificationService';
import { useAppData, useAppDataEffect } from '@/state/AppDataContext';
import { errorMessage } from '@/utils/error';

/** `all` = todas as categorias; `uncategorized` = sem categoria; número = id da categoria. */
type CategoryFilter = 'all' | 'uncategorized' | number;

const STATUS_OPTIONS: { value: TaskStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'completed', label: 'Concluídas' },
];

export default function TaskListScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { refresh: notifyRefresh, notice, setNotice } = useAppData();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const reload = useCallback(async () => {
    try {
      const [taskRows, categoryRows] = await Promise.all([
        listTasks(db, {
          status: statusFilter,
          categoryId:
            categoryFilter === 'all' ? undefined : categoryFilter === 'uncategorized' ? null : categoryFilter,
        }),
        listCategories(db),
      ]);
      // Categoria selecionada foi excluída em outra tela → volta para "todas".
      // O novo valor muda a identidade de `reload` e o efeito refaz a busca.
      if (typeof categoryFilter === 'number' && !categoryRows.some((c) => c.id === categoryFilter)) {
        setCategoryFilter('all');
      }
      setTasks(taskRows);
      setCategories(categoryRows);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível carregar as tarefas.'));
    } finally {
      setLoading(false);
    }
  }, [db, statusFilter, categoryFilter]);

  useAppDataEffect(reload);

  const filtersActive = statusFilter !== 'all' || categoryFilter !== 'all';

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setCategoryFilter('all');
  }, []);

  const handleToggle = useCallback(
    (task: Task) => {
      void (async () => {
        try {
          const updated = await updateTask(db, task.id, {
            title: task.title,
            description: task.description,
            completed: !task.completed,
            dueDateTime: task.dueDateTime,
            categoryId: task.categoryId,
            notificationId: task.notificationId,
          });
          if (updated) {
            // Concluída → cancela o lembrete; reaberta com data futura → agenda de novo.
            const sync = await syncTaskNotification(db, updated, { requestPermission: true });
            if (sync.warning) {
              setNotice({ message: sync.warning, canOpenSettings: sync.permissionDenied });
            }
          }
          notifyRefresh();
        } catch (e) {
          setError(errorMessage(e, 'Não foi possível atualizar a tarefa.'));
        }
      })();
    },
    [db, notifyRefresh, setNotice],
  );

  const handleOpenTask = useCallback((task: Task) => {
    router.push({ pathname: '/task/[id]', params: { id: String(task.id) } });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Tasks</ThemedText>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push('/task/new')}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              + Nova tarefa
            </ThemedText>
          </Pressable>
        </View>

        {notice ? (
          <View style={[styles.noticeBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" style={styles.noticeText}>
              {notice.message}
            </ThemedText>
            <View style={styles.noticeActions}>
              {notice.canOpenSettings ? (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}
                  onPress={() => {
                    // Se a plataforma não abrir as configurações, seguimos sem quebrar.
                    void Linking.openSettings().catch(() => undefined);
                  }}>
                  <ThemedText type="smallBold">Abrir configurações</ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}
                onPress={() => setNotice(null)}>
                <ThemedText type="smallBold">Fechar</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
          onPress={() => router.push('/categories')}>
          <ThemedText type="smallBold">Gerenciar categorias</ThemedText>
        </Pressable>

        <View style={styles.filters}>
          <View style={styles.chipRow} accessibilityRole="tablist" accessibilityLabel="Filtrar por status">
            {STATUS_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={statusFilter === option.value}
                onPress={() => setStatusFilter(option.value)}
              />
            ))}
          </View>

          <View style={styles.chipRow} accessibilityLabel="Filtrar por categoria">
            <Chip
              label="Todas as categorias"
              selected={categoryFilter === 'all'}
              onPress={() => setCategoryFilter('all')}
            />
            <Chip
              label="Sem categoria"
              selected={categoryFilter === 'uncategorized'}
              onPress={() => setCategoryFilter('uncategorized')}
            />
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={categoryFilter === category.id}
                onPress={() => setCategoryFilter(category.id)}
              />
            ))}
          </View>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(task) => String(task.id)}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
            renderItem={({ item }) => (
              <TaskItem
                task={item}
                categoryName={categories.find((category) => category.id === item.categoryId)?.name ?? null}
                onPress={handleOpenTask}
                onToggle={handleToggle}
              />
            )}
            ListEmptyComponent={
              filtersActive ? (
                <View style={styles.emptyFiltered}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                    Nenhuma tarefa corresponde aos filtros selecionados.
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.clearButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
                    onPress={handleClearFilters}>
                    <ThemedText type="smallBold">Limpar filtros</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  Nenhuma tarefa ainda. Toque em “+ Nova tarefa” para criar a primeira.
                </ThemedText>
              )
            }
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  primaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  errorBox: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  noticeBox: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderLeftWidth: 3,
    borderLeftColor: '#d9a441',
  },
  noticeText: {
    flexShrink: 1,
  },
  noticeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  noticeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  filters: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  emptyFiltered: {
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  clearButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
