import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { CategoryPicker } from '@/components/CategoryPicker';
import { DueDateTimeField } from '@/components/DueDateTimeField';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Category } from '@/models/category';
import { type Task } from '@/models/task';
import { listCategories } from '@/repositories/categoryRepository';
import { createTask, deleteTask, getTaskById, updateTask } from '@/repositories/taskRepository';
import { cancelTaskNotification, syncTaskNotification } from '@/services/notificationService';
import { useAppData } from '@/state/AppDataContext';
import { isValidISO } from '@/utils/date';
import { errorMessage } from '@/utils/error';

export default function TaskEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { refresh: notifyRefresh, setNotice } = useAppData();

  const isNew = id === 'new';
  const taskId = Number(id);

  const [existing, setExisting] = useState<Task | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completed, setCompleted] = useState(false);
  const [dueDateTime, setDueDateTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loadedCategories = await listCategories(db);
      setCategories(loadedCategories);

      if (isNew) return;

      const task = await getTaskById(db, taskId);
      if (!task) {
        setError('Tarefa não encontrada.');
        return;
      }
      setExisting(task);
      setTitle(task.title);
      setDescription(task.description ?? '');
      setCompleted(task.completed);
      setCategoryId(task.categoryId);
      // Data corrompida/ inválida nunca deve quebrar o editor.
      setDueDateTime(isValidISO(task.dueDateTime) ? task.dueDateTime : null);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível carregar os dados.'));
    } finally {
      setLoading(false);
    }
  }, [db, isNew, taskId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSave = useCallback(async () => {
    if (saving) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setError('O título é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const selectedCategoryId =
        categoryId != null && categories.some((category) => category.id === categoryId)
          ? categoryId
          : null;

      // Data inválida é normalizada para "sem vencimento" em vez de quebrar o save.
      const normalizedDue = isValidISO(dueDateTime) ? dueDateTime : null;

      const input = {
        title: trimmedTitle,
        description: description.trim() || null,
        completed,
        dueDateTime: normalizedDue,
        categoryId: selectedCategoryId,
        notificationId: existing?.notificationId ?? null,
      };

      const saved = isNew ? await createTask(db, input) : await updateTask(db, taskId, input);
      if (!saved) {
        throw new Error('Não foi possível gravar a tarefa.');
      }

      // Matriz de notificações: cancela a anterior e agenda a nova (ou nada).
      const sync = await syncTaskNotification(db, saved, { requestPermission: true });
      if (sync.warning) {
        setNotice({ message: sync.warning, canOpenSettings: sync.permissionDenied });
      }

      notifyRefresh();
      router.back();
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível salvar a tarefa.'));
      setSaving(false);
    }
  }, [categories, categoryId, completed, db, description, dueDateTime, existing, isNew, notifyRefresh, saving, setNotice, taskId, title]);

  const handleDelete = useCallback(async () => {
    if (isNew || saving) return;
    setSaving(true);
    try {
      if (existing) {
        await cancelTaskNotification(db, existing);
      }
      await deleteTask(db, taskId);
      notifyRefresh();
      router.back();
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível excluir a tarefa.'));
      setSaving(false);
      setConfirmingDelete(false);
    }
  }, [db, existing, isNew, notifyRefresh, saving, taskId]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!isNew && !existing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ThemedView style={styles.form}>
          <Stack.Screen options={{ title: 'Tarefa' }} />
          <ThemedText type="subtitle">Tarefa não encontrada</ThemedText>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
            onPress={() => router.back()}>
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: isNew ? 'Nova tarefa' : `Tarefa #${taskId}` }} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <ThemedText type="subtitle">{isNew ? 'Nova tarefa' : `Tarefa #${taskId}`}</ThemedText>

            <ThemedText type="smallBold">Título *</ThemedText>
            <TextInput
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (error) setError(null);
              }}
              placeholder="Ex.: Entregar o trabalho"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              autoCapitalize="sentences"
              returnKeyType="done"
              accessibilityLabel="Título da tarefa"
            />

            <ThemedText type="smallBold">Descrição</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Opcional"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.input,
                styles.multiline,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
              accessibilityLabel="Descrição da tarefa"
            />

            <DueDateTimeField
              value={dueDateTime}
              onChange={(iso) => {
                setDueDateTime(iso);
                if (error) setError(null);
              }}
              disabled={saving}
            />

            <ThemedText type="smallBold">Categoria</ThemedText>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

            <View style={[styles.switchRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Concluída</ThemedText>
              <Switch
                value={completed}
                onValueChange={setCompleted}
                accessibilityLabel="Marcar como concluída"
              />
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{error}</ThemedText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              style={({ pressed }) => [
                styles.primaryButton,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={() => void handleSave()}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {saving ? 'Salvando…' : 'Salvar'}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
              onPress={() => router.back()}>
              <ThemedText type="smallBold">Cancelar</ThemedText>
            </Pressable>

            {!isNew ? (
              confirmingDelete ? (
                <View style={[styles.confirmBox, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">Excluir esta tarefa? Esta ação não pode ser desfeita.</ThemedText>
                  <View style={styles.confirmActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
                      onPress={() => void handleDelete()}>
                      <ThemedText type="smallBold" style={styles.primaryButtonText}>
                        Excluir
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.cancelConfirm, pressed && styles.pressed]}
                      onPress={() => setConfirmingDelete(false)}>
                      <ThemedText type="smallBold">Cancelar</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                  onPress={() => setConfirmingDelete(true)}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    Excluir tarefa
                  </ThemedText>
                </Pressable>
              )
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  input: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  switchRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  errorBox: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  primaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    marginTop: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.three,
  },
  dangerButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#d13b3b',
    marginTop: Spacing.three,
  },
  confirmBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.three,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  confirmButton: {
    minHeight: 44,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#d13b3b',
  },
  cancelConfirm: {
    minHeight: 44,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#d13b3b',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});
