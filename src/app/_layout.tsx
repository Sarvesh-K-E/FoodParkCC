import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { ThemeProvider, useAppTheme } from '../utils/ThemeContext';
import { loadSessionAsync } from '../utils/api';
import { PostHogProvider } from 'posthog-react-native';

function InnerLayout() {
  const { isDark } = useAppTheme();

  // Custom scrollbar for Web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.innerHTML = `
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${isDark ? '#0F172A' : '#F1F5F9'}; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#334155' : '#CBD5E1'}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${isDark ? '#475569' : '#94A3B8'}; }
      `;
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
    }
  }, [isDark]);


  useEffect(() => {
    if (Platform.OS === 'web') {
      // Register Service Worker for PWA installability
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
      }

      // iOS does not support native install prompts, so we must show our own
      const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      const isIosStandalone = () => ('standalone' in window.navigator) && (window.navigator as any).standalone;
    }
  }, []);

  return (
    <>

      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          },
          headerTintColor: isDark ? '#fff' : '#0F172A',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: isDark ? '#121212' : '#F1F5F9',
          }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="menu" options={{ title: 'Menu' }} />
        <Stack.Screen name="cart" options={{ title: 'Your Cart', presentation: 'modal' }} />
        <Stack.Screen name="history" options={{ title: 'Orders' }} />
      </Stack>

    </>
  );
}

export default function RootLayout() {
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    loadSessionAsync().finally(() => {
      setSessionLoaded(true);
    });
  }, []);

  if (!sessionLoaded) return null;

  return (
    <PostHogProvider 
      apiKey="phc_xnzAhHkrqXdxmcb6365bHoNCeoHH2MxeChpjXL6AYXU4" 
      options={{
        host: 'https://foodparkcc.fpcc.workers.dev/api/data',
        enableSessionReplay: false, // Explicitly disabled for privacy
      }}
    >
      <ThemeProvider>
        <InnerLayout />
      </ThemeProvider>
    </PostHogProvider>
  );
}
