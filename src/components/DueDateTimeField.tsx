import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTimeLocal, isOverdue, toDate, toISO } from '@/utils/date';

export type DueDateTimeFieldProps = {
  /** ISO 8601 UTC ou `null`. */
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
};

const WEB_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

/**
 * Campo de vencimento (data + hora) do editor.
 *
 * - **Android:** diálogo em dois passos (data → hora).
 * - **iOS:** seletor inline `datetime` com botão "Concluir".
 * - **Web:** o pacote nativo não tem implementação web, então um campo de
 *   texto `AAAA-MM-DD HH:MM` mantém a funcionalidade no navegador.
 *
 * O valor de saída é sempre ISO 8601 UTC; a exibição é local.
 */
export function DueDateTimeField({ value, onChange, disabled = false }: DueDateTimeFieldProps) {
  const theme = useTheme();
  const [showNative, setShowNative] = useState(false);
  const [androidMode, setAndroidMode] = useState<'date' | 'time'>('date');
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [webText, setWebText] = useState<string | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);

  const overdue = isOverdue(value, false);
  const label = value
    ? formatDateTimeLocal(value) ?? 'Data inválida'
    : 'Sem data/hora';

  const pickerValue = useMemo(() => {
    const parsed = toDate(value);
    if (parsed) return parsed;
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  }, [value]);

  const openNative = () => {
    if (disabled) return;
    setNativeError(null);
    setAndroidMode('date');
    setPendingDate(null);
    setShowNative(true);
  };

  const handleClear = () => {
    onChange(null);
    setWebText('');
    setWebError(null);
  };

  const handleNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowNative(false);
        setPendingDate(null);
        return;
      }
      if (!date) return;

      if (androidMode === 'date') {
        // Passo 1: guarda a data escolhida e abre o seletor de hora.
        setPendingDate(date);
        setAndroidMode('time');
        return;
      }

      // Passo 2: combina a hora escolhida com a data do passo 1.
      const base = pendingDate ?? pickerValue;
      const combined = new Date(date);
      combined.setFullYear(base.getFullYear(), base.getMonth(), base.getDate());
      onChange(toISO(combined));
      setShowNative(false);
      setPendingDate(null);
      return;
    }

    if (event.type === 'dismissed') {
      setShowNative(false);
      return;
    }
    if (event.type === 'set' && date) {
      onChange(toISO(date));
    }
  };

  const handleWebChange = (text: string) => {
    setWebText(text);
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setWebError(null);
      onChange(null);
      return;
    }
    const match = WEB_PATTERN.exec(trimmed);
    if (!match) {
      setWebError('Use o formato AAAA-MM-DD HH:MM.');
      return;
    }
    const [, y, m, d, hh, mm] = match;
    const candidate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    const valid =
      candidate.getFullYear() === Number(y) &&
      candidate.getMonth() === Number(m) - 1 &&
      candidate.getDate() === Number(d) &&
      !Number.isNaN(candidate.getTime());
    if (!valid) {
      setWebError('Data inválida.');
      return;
    }
    setWebError(null);
    onChange(toISO(candidate));
  };

  const webInitial = useMemo(() => {
    if (webText != null) return webText;
    const parsed = toDate(value);
    if (!parsed) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }, [value, webText]);

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <View style={styles.labels}>
          <ThemedText type="smallBold">Vencimento (opcional)</ThemedText>
          <ThemedText type="small" themeColor={overdue ? 'text' : 'textSecondary'} style={overdue ? styles.overdue : undefined}>
            {label}
            {overdue ? ' · vencida' : ''}
          </ThemedText>
        </View>

        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar data e hora de vencimento"
            disabled={disabled}
            onPress={openNative}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <ThemedText type="link">Alterar</ThemedText>
          </Pressable>

          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remover data de vencimento"
              disabled={disabled}
              onPress={handleClear}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.clear}>
                Limpar
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {Platform.OS === 'web' ? (
        <View>
          <TextInput
            value={webInitial}
            onChangeText={handleWebChange}
            placeholder="AAAA-MM-DD HH:MM"
            placeholderTextColor={theme.textSecondary}
            editable={!disabled}
            accessibilityLabel="Vencimento (AAAA-MM-DD HH:MM)"
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          />
          {webError ? <ThemedText type="small" style={styles.overdue}>{webError}</ThemedText> : null}
        </View>
      ) : null}

      {Platform.OS === 'android' && showNative ? (
        <DateTimePicker
          value={pickerValue}
          mode={androidMode}
          display="default"
          is24Hour
          onChange={handleNativeChange}
          onError={() => {
            setNativeError('Não foi possível abrir o seletor de data/hora.');
            setShowNative(false);
          }}
        />
      ) : null}

      {Platform.OS === 'ios' && showNative ? (
        <View style={styles.inline}>
          <DateTimePicker
            value={pickerValue}
            mode="datetime"
            display="inline"
            onChange={handleNativeChange}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowNative(false)}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.doneText}>
              Concluir
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {nativeError ? <ThemedText type="small" style={styles.overdue}>{nativeError}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  labels: {
    flex: 1,
    gap: Spacing.half,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  clear: {
    color: '#d13b3b',
  },
  overdue: {
    color: '#d13b3b',
  },
  input: {
    minHeight: 44,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  inline: {
    gap: Spacing.two,
  },
  done: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
  },
  doneText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
});
