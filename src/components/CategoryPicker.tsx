import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Spacing } from '@/constants/theme';
import { type Category } from '@/models/category';

export type CategoryPickerProps = {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
};

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const options = [{ id: null as number | null, name: 'Sem categoria' }, ...categories];

  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Chip
          key={option.id == null ? 'none' : String(option.id)}
          label={option.name}
          selected={option.id === value}
          accessibilityLabel={`Categoria: ${option.name}`}
          onPress={() => onChange(option.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
