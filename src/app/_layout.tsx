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

  const [showPWA, setShowPWA] = useState(false);

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

      {showPWA && (
        <View style={{
          position: 'absolute', bottom: 20, left: 20, right: 20,
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          padding: 16, borderRadius: 12,
          shadowColor: '#000', shadowOffset: { width:0, height:10 }, shadowOpacity: 0.3, shadowRadius: 20,
          elevation: 10, zIndex: 9999, flexDirection: 'row', alignItems: 'center'
        }}>
          <View style={{flex: 1}}>
            <Text style={{color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: 'bold', fontSize: 16}}>Install FoodParkCC</Text>
            <Text style={{color: isDark ? '#94A3B8' : '#475569', fontSize: 14, marginTop: 4}}>
              Tap your browser's menu or Share button and select "Add to Home Screen" to install the app!
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowPWA(false)} style={{padding: 8, paddingLeft: 16}}>
            <Text style={{color: '#38BDF8', fontWeight: 'bold'}}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
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
