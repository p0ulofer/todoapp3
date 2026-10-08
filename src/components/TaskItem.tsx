import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Task } from '@/models/task';
import { formatDateTimeLocal, isOverdue } from '@/utils/date';

export type TaskItemProps = {
  task: Task;
  categoryName?: string | null;
  onPress: (task: Task) => void;
  onToggle: (task: Task) => void;
};

export function TaskItem({ task, categoryName, onPress, onToggle }: TaskItemProps) {
  const theme = useTheme();
  const dueLabel = formatDateTimeLocal(task.dueDateTime);
  const overdue = isOverdue(task.dueDateTime, task.completed);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={`Marcar "${task.title}" como ${task.completed ? 'pendente' : 'concluída'}`}
        hitSlop={8}
        onPress={() => onToggle(task)}
        style={[
          styles.checkbox,
          { borderColor: theme.textSecondary },
          task.completed && styles.checkboxChecked,
        ]}>
        {task.completed ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => onPress(task)} style={styles.body}>
        <ThemedText style={task.completed ? styles.completedTitle : undefined}>
          {task.title}
        </ThemedText>
        {task.description ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {task.description}
          </ThemedText>
        ) : null}
        {dueLabel ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={overdue ? styles.overdue : undefined}>
            {overdue ? `Vencida: ${dueLabel}` : `Vence: ${dueLabel}`}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {task.completed ? 'Concluída' : 'Pendente'}
          {categoryName ? ` · ${categoryName}` : ''}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 56,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  checkboxChecked: {
    backgroundColor: '#3c87f7',
    borderColor: '#3c87f7',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
  },
  overdue: {
    color: '#d13b3b',
    fontWeight: '700',
  },
});
