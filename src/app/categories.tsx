import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Category } from '@/models/category';
import {
  createCategory,
  deleteCategory,
  listCategories,
  countTasksPerCategory,
  renameCategory,
} from '@/repositories/categoryRepository';
import { useAppData, useAppDataEffect } from '@/state/AppDataContext';
import { errorMessage } from '@/utils/error';

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { refresh: notifyRefresh } = useAppData();

  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const [rows, perCategory] = await Promise.all([
        listCategories(db),
        countTasksPerCategory(db),
      ]);
      setCategories(rows);
      setCounts(perCategory);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível carregar as categorias.'));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useAppDataEffect(reload);

  const handleCreate = useCallback(async () => {
    if (busy) return;
    const name = newName.trim();
    if (name.length === 0) {
      setError('O nome da categoria é obrigatório.');
      return;
    }
    setBusy(true);
    try {
      await createCategory(db, { name });
      setNewName('');
      setError(null);
      notifyRefresh();
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível criar a categoria.'));
    } finally {
      setBusy(false);
    }
  }, [busy, db, newName, notifyRefresh]);

  const handleRenameSave = useCallback(async () => {
    if (busy || editingId == null) return;
    const name = editingName.trim();
    if (name.length === 0) {
      setError('O nome da categoria é obrigatório.');
      return;
    }
    setBusy(true);
    try {
      await renameCategory(db, editingId, name);
      setEditingId(null);
      setEditingName('');
      setError(null);
      notifyRefresh();
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível renomear a categoria.'));
    } finally {
      setBusy(false);
    }
  }, [busy, db, editingId, editingName, notifyRefresh]);

  const handleDelete = useCallback(async () => {
    if (busy || pendingDeleteId == null) return;
    setBusy(true);
    try {
      await deleteCategory(db, pendingDeleteId);
      setPendingDeleteId(null);
      setError(null);
      notifyRefresh();
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível excluir a categoria.'));
    } finally {
      setBusy(false);
    }
  }, [busy, db, pendingDeleteId, notifyRefresh]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Categorias</ThemedText>

        <View style={[styles.createRow, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={newName}
            onChangeText={(value) => {
              setNewName(value);
              if (error) setError(null);
            }}
            placeholder="Nome da nova categoria"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            accessibilityLabel="Nome da nova categoria"
            returnKeyType="done"
            onSubmitEditing={() => void handleCreate()}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={({ pressed }) => [
              styles.addButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={() => void handleCreate()}>
            <ThemedText type="smallBold" style={styles.lightText}>
              Adicionar
            </ThemedText>
          </Pressable>
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
          <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {categories.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Nenhuma categoria. Crie a primeira acima.
              </ThemedText>
            ) : null}

            {categories.map((category) => {
              const taskCount = counts[category.id] ?? 0;
              const isEditing = editingId === category.id;
              const isPendingDelete = pendingDeleteId === category.id;

              return (
                <View
                  key={category.id}
                  style={[styles.categoryCard, { backgroundColor: theme.backgroundElement }]}>
                  {isEditing ? (
                    <View style={styles.editRow}>
                      <TextInput
                        value={editingName}
                        onChangeText={setEditingName}
                        style={[styles.input, { color: theme.text }]}
                        accessibilityLabel={`Novo nome para ${category.name}`}
                        returnKeyType="done"
                        onSubmitEditing={() => void handleRenameSave()}
                        autoFocus
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                        onPress={() => void handleRenameSave()}>
                        <ThemedText type="smallBold" style={styles.lightText}>
                          Salvar
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.smallButtonGhost, pressed && styles.pressed]}
                        onPress={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}>
                        <ThemedText type="smallBold">Cancelar</ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View style={styles.categoryHeader}>
                        <ThemedText type="smallBold">{category.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {taskCount === 0
                            ? 'sem tarefas'
                            : `${taskCount} ${taskCount === 1 ? 'tarefa' : 'tarefas'}`}
                        </ThemedText>
                      </View>

                      <View style={styles.actions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          style={({ pressed }) => [styles.smallButtonGhost, pressed && styles.pressed]}
                          onPress={() => {
                            setEditingId(category.id);
                            setEditingName(category.name);
                            setPendingDeleteId(null);
                          }}>
                          <ThemedText type="smallBold">Editar</ThemedText>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          style={({ pressed }) => [styles.smallButtonDanger, pressed && styles.pressed]}
                          onPress={() => setPendingDeleteId(category.id)}>
                          <ThemedText type="smallBold" style={styles.lightText}>
                            Excluir
                          </ThemedText>
                        </Pressable>
                      </View>
                    </>
                  )}

                  {isPendingDelete ? (
                    <View style={styles.confirmBox}>
                      <ThemedText type="small">
                        Excluir “{category.name}”?
                        {taskCount > 0
                          ? ` ${taskCount} ${taskCount === 1 ? 'tarefa ficará' : 'tarefas ficarão'} sem categoria.`
                          : ' Nenhuma tarefa usa esta categoria.'}
                      </ThemedText>
                      <View style={styles.actions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy}
                          style={({ pressed }) => [styles.smallButtonDanger, pressed && styles.pressed]}
                          onPress={() => void handleDelete()}>
                          <ThemedText type="smallBold" style={styles.lightText}>
                            Excluir
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.smallButtonGhost, pressed && styles.pressed]}
                          onPress={() => setPendingDeleteId(null)}>
                          <ThemedText type="smallBold">Cancelar</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.backButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
          onPress={() => router.back()}>
          <ThemedText type="smallBold">Voltar</ThemedText>
        </Pressable>
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
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  addButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  lightText: {
    color: '#ffffff',
  },
  errorBox: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  categoryCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  smallButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  smallButtonGhost: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#3c87f7',
  },
  smallButtonDanger: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#d13b3b',
  },
  confirmBox: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#d13b3b',
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.three,
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
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});
