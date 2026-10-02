import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
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
      setError('No Order ID provided');
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
        setError('Failed to load QR Code');
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
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        try {
          await navigator.share({ text: msg });
        } catch (err) {}
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F1F5F9' }]}>
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          Share Order #{orderId}
        </Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#38BDF8" style={{ marginVertical: 30 }} />
        ) : error ? (
          <Text style={{ color: '#EF4444', marginVertical: 20 }}>{error}</Text>
        ) : (
          <>
            <Image source={{ uri: qrBase64! }} style={styles.qrImage} resizeMode="contain" />
            <TouchableOpacity style={styles.button} onPress={handleShare}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
              </Svg>
              <Text style={styles.buttonText}>Tap to Open Share Menu</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
  qrImage: {
    width: 250,
    height: 250,
    borderRadius: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0EA5E9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  }
});
