import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../utils/api';
import { useAppTheme } from '../utils/ThemeContext';

export default function ShareBridgeScreen() {
  const { orderId } = useLocalSearchParams();
  const { isDark } = useAppTheme();
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setError('Invalid Order');
      setLoading(false);
      return;
    }

    const fetchQR = async () => {
      try {
        const handleData = (rawB64: any) => {
          if (rawB64) {
            const cleanB64 = String(rawB64).replace(/^"|"$/g, '').trim();
            setQrBase64(`data:image/png;base64,${cleanB64}`);
            setLoading(false);
          }
        };
        const rawB64 = await api.getQRData(orderId as string, handleData);
        if (rawB64) handleData(rawB64);
      } catch (err) {
        setError('Failed');
        setLoading(false);
      }
    };
    
    fetchQR();
  }, [orderId]);

  const handleShare = async () => {
    if (!qrBase64 || typeof window === 'undefined' || !navigator.share) return;
    
    const msg = `Here's my FoodPark QR Code for Order #${orderId}! 🍔\n\n📱 Download the Android app:\nhttps://github.com/Sarvesh-K-E/FoodParkCC/releases/latest\n\n🍎 Use on iPhone / Web:\nhttp://foodparkcc.pages.dev/\n\n🔗 GitHub: https://github.com/Sarvesh-K-E/FoodParkCC`;

    try {
      const fetchRes = await fetch(qrBase64);
      const blob = await fetchRes.blob();
      const file = new File([blob], `order_${orderId}.png`, { type: 'image/png' });
      
      await navigator.share({ 
        text: msg,
        files: [file]
      });
      
      // Auto-close the WebBrowser by redirecting back to the app's deep link!
      window.location.href = 'foodparkcc://';
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        try {
          await navigator.share({ text: msg });
          window.location.href = 'foodparkcc://';
        } catch (err) {}
      } else {
        // User cancelled share, go back to app
        window.location.href = 'foodparkcc://';
      }
    }
  };

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F1F5F9' }]} 
      onPress={handleShare}
    >
      {loading ? (
        <ActivityIndicator size="large" color="#38BDF8" />
      ) : error ? (
        <Text style={{ color: '#EF4444' }}>{error}</Text>
      ) : (
        <Text style={[styles.text, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Tap anywhere to complete share...
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.5
  }
});
