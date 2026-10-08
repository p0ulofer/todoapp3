import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DATABASE_NAME, onInitDatabase } from '@/db/database';
import { configureNotifications } from '@/services/notificationService';
import { AppDataProvider } from '@/state/AppDataContext';

SplashScreen.preventAutoHideAsync();

// Handler de notificações recebidas com o app em primeiro plano (fase 10).
configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={onInitDatabase}>
        <AppDataProvider>
          <Stack>
            <Stack.Screen name="index" options={{ title: 'Tasks' }} />
            <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
            <Stack.Screen name="categories" options={{ title: 'Categories' }} />
          </Stack>
        </AppDataProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
