import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { api, setSession, getSession, setPromptFlag } from '../utils/api';
import { useAppTheme } from '../utils/ThemeContext';
import CustomSwitch from '../components/CustomSwitch';

export default function LoginScreen() {
  const { isDark, toggleTheme } = useAppTheme();
  const styles = getStyles(isDark);
  const router = useRouter();
  const [mobileNo, setMobileNo] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session && session.internalId && session.pin) {
      router.replace('/home');
    }
  }, []);

  const handleLogin = async () => {
    if (!mobileNo || !pin) {
      setError('Login Failed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // The API uses "MobileNo" which actually is the registration number in the backend
      let response = await api.login(mobileNo, pin);
      
      let internalId = '';
      let logId = '';

      if (Array.isArray(response) && response.length > 0) {
        const data = response[0];
        logId = data.logid || '1'; // Default to 1 if missing, we don't strictly need it
        if (data.OtpSts && (data.OtpSts.includes('Success') || data.OtpSts.includes('duplicate'))) {
          const parts = data.OtpSts.split('|');
          if (parts.length > 6) {
            internalId = parts[6]; // parts[6] is the ID (e.g. 51816)
            const name = parts[5]; // parts[5] is the Name (e.g. SARVESH K E)
            
            // Start the session
            setSession(mobileNo, internalId, logId, name, pin);
            await setPromptFlag();
          }
        }
      }
      
      if (!internalId) {
        setError('Login Failed');
        setLoading(false);
        return;
      }
      
      router.replace('/home'); 
    } catch (e) {
      setError('Login Failed');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.overlay}>
        <View style={styles.themeToggleWrapper}>
          <Text style={styles.themeLabel}>{isDark ? 'Dark' : 'Light'}</Text>
          <CustomSwitch value={isDark} onValueChange={toggleTheme} isDark={isDark} />
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>FoodParkCC</Text>
          <Text style={styles.subtitle}>An ordering app tailored for VIT Chennai's Proodle Foodpark</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Login ID</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              keyboardType="phone-pad"
              value={mobileNo}
              onChangeText={setMobileNo}
              maxLength={15}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor={isDark ? "#888" : "#A0AEC0"}
              keyboardType="number-pad"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              maxLength={6}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.forgotBtn}
            onPress={() => Linking.openURL('https://vit-proodle.expertsoftsys.com/home/Index')}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.disclaimerText}>
            FoodParkCC is an unofficial third-party client and is not affiliated with or endorsed by VIT Chennai or Proodle. Please read our GitHub README for information about privacy, security, data handling, and terms of use.
          </Text>
        <View style={styles.linksContainer}>
          <TouchableOpacity 
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://github.com/Sarvesh-K-E/FoodParkCC')}
          >
            <Svg viewBox="0 0 24 24" width="16" height="16" fill={isDark ? '#F8FAFC' : '#0F172A'}>
              <Path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </Svg>
            <Text style={styles.linkText}>GitHub</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkBtn}
            onPress={() => Linking.openURL('http://foodparkcc.pages.dev/')}
          >
            <Svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={isDark ? '#F8FAFC' : '#0F172A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="10" />
              <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </Svg>
            <Text style={styles.linkText}>Website</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://github.com/Sarvesh-K-E/FoodParkCC/releases/latest/download/app-release.apk')}
          >
            <Svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={isDark ? '#F8FAFC' : '#0F172A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </Svg>
            <Text style={styles.linkText}>Download APK</Text>
          </TouchableOpacity>
        </View>
        </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#121212' : '#F1F5F9',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  overlay: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  themeToggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#94A3B8' : '#475569',
    marginRight: 10,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: isDark ? '#38BDF8' : '#1D4ED8',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: isDark ? '#94A3B8' : '#475569',
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? '#F8FAFC' : '#0F172A',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#94A3B8' : '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: isDark ? '#121212' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#CBD5E1',
    borderRadius: 8,
    padding: 16,
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 16,
  },
  button: {
    backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  forgotBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    color: isDark ? '#38BDF8' : '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  footerContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    color: isDark ? '#64748B' : '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  linkText: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  }
});
