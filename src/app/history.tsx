import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Platform, Modal, AppState, Pressable, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import * as Brightness from 'expo-brightness';
import Svg, { Path } from 'react-native-svg';
import { api, getSession, getBrightnessPref, setBrightnessPref } from '../utils/api';
import { useAppTheme } from '../utils/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { isDark } = useAppTheme();
  const styles = getStyles(isDark);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const activeQR = useRef<string | null>(null);
  const [loadingQR, setLoadingQR] = useState<string | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[] | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<string>('');
  const [autoBrightness, setAutoBrightness] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const originalBrightness = useRef<number | null>(null);

  useEffect(() => {
    getBrightnessPref().then(pref => setAutoBrightness(pref));
    fetchHistory();
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web' || !autoBrightness) return;
      
      try {
        if (selectedQR) {
          if (Platform.OS === 'ios' && originalBrightness.current === null) {
            originalBrightness.current = await Brightness.getBrightnessAsync();
          }
          await Brightness.setBrightnessAsync(1);
        } else {
          if (Platform.OS === 'android') {
            await Brightness.restoreSystemBrightnessAsync();
          } else if (Platform.OS === 'ios' && originalBrightness.current !== null) {
            await Brightness.setBrightnessAsync(originalBrightness.current);
            originalBrightness.current = null;
          }
        }
      } catch (e) {}
    })();
  }, [selectedQR, autoBrightness]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'android') {
        Brightness.restoreSystemBrightnessAsync().catch(() => {});
      } else if (Platform.OS === 'ios' && originalBrightness.current !== null) {
        Brightness.setBrightnessAsync(originalBrightness.current).catch(() => {});
        originalBrightness.current = null;
      }
    };
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setIsSyncing(true);
      setIsSynced(false);
      const session = getSession();
      
      const formatAndSetOrders = (res: any) => {
        if (res && Array.isArray(res)) {
          res.forEach(order => {
            if (order.Status === 'Success' || order.status === 'Success') {
              const oid = (order.OrderId || order.OrderNumber || order.orderId || '').toString();
              api.getQRData(oid).catch(() => {});
            }
          });

          setOrders(res.map(order => ({
            orderId: (order.OrderId || order.OrderNumber || order.orderId || '').toString(),
            sname: order.sname || 'Order',
            date: order.OrderDate || order.dtstr || order.date || new Date().toLocaleDateString(),
            time: order.OrderTime || '',
            total: order.NetAmount || order.ItemTotal || order.total || 0,
            status: order.Status || order.status || 'Unknown',
            cancelStatus: order.CancelStatus || ''
          })));
        } else {
          setDebugData(typeof res === 'object' ? JSON.stringify(res) : String(res));
          setOrders([]);
        }
        setLoading(false);
      };

      const res = await api.getOrderHistory(session.internalId, (cachedData) => {
        if (cachedData) formatAndSetOrders(cachedData);
      });
      
      if (res) formatAndSetOrders(res);
      
      setIsSyncing(false);
      setIsSynced(true);
      setTimeout(() => setIsSynced(false), 3000);
    } catch (e) {
      console.error(e);
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const showQR = async (orderId: string) => {
    setLoadingQR(orderId);
    activeQR.current = orderId;
    try {
      const handleData = (rawB64: any) => {
        if (rawB64 && activeQR.current === orderId) {
          const cleanB64 = String(rawB64).replace(/^"|"$/g, '').trim();
          setSelectedQR(`data:image/png;base64,${cleanB64}`);
          setLoadingQR(null);
        }
      };

      const rawB64 = await api.getQRData(orderId, handleData);
      if (rawB64) handleData(rawB64);
    } catch (e) {
      console.error(e);
      alert('Failed to load QR Code.');
      if (activeQR.current === orderId) setLoadingQR(null);
    }
  };

  const showOrderDetails = async (orderId: string) => {
    setLoadingOrderDetails(orderId);
    try {
      const res = await api.getOrderItems(orderId);
      if (res && Array.isArray(res)) {
        setSelectedOrderItems(res);
      } else {
        alert('Could not load order details.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to fetch order details.');
    } finally {
      setLoadingOrderDetails(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.dateText}>{item.sname}</Text>
        <Text style={item.status === 'Success' ? styles.statusSuccess : item.status === 'Open' ? styles.statusFailed : styles.statusPending}>{item.status === 'Open' ? 'Failed' : item.status}</Text>
      </View>
      <Text style={styles.itemText}>{item.date}{item.time ? ` at ${item.time}` : ''}</Text>
      <Text style={styles.totalText}>₹{item.total}.00</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.detailsBtn} onPress={() => showOrderDetails(item.orderId)} disabled={loadingOrderDetails === item.orderId}>
          {loadingOrderDetails === item.orderId ? (
            <ActivityIndicator color={isDark ? '#fff' : '#000'} size="small" />
          ) : (
            <Text style={styles.detailsBtnText}>Details</Text>
          )}
        </TouchableOpacity>
        {item.status === 'Success' && (
          <TouchableOpacity style={styles.qrBtn} onPress={() => showQR(item.orderId)} disabled={loadingQR === item.orderId}>
            {loadingQR === item.orderId ? (
              <ActivityIndicator color={isDark ? '#fff' : '#000'} size="small" />
            ) : (
              <Text style={styles.qrBtnText}>Show QR</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.orderId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? null : <Text style={styles.emptyText}>No orders found.</Text>}
      />

      <Stack.Screen 
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, color: isDark ? '#fff' : '#0F172A', marginRight: 8 }}>Orders</Text>
              {isSyncing && <ActivityIndicator size="small" color="#0EA5E9" />}
              {isSynced && !isSyncing && (
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20 6L9 17l-5-5" />
                </Svg>
              )}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={fetchHistory} disabled={isSyncing} style={{ marginRight: 16, opacity: isSyncing ? 0.5 : 1 }}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#F8FAFC' : '#0F172A'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <Path d="M21 3v5h-5" />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSettings(true)} style={{ marginRight: 16 }}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#F8FAFC' : '#0F172A'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                </Svg>
              </TouchableOpacity>
            </View>
          )
        }} 
      />

      <Modal 
        visible={!!selectedQR} 
        transparent 
        animationType="fade"
        onRequestClose={() => { setSelectedQR(null); activeQR.current = null; }}
      >
        <Pressable style={styles.modalContainer} onPress={() => { setSelectedQR(null); activeQR.current = null; }}>
          <Pressable style={styles.qrWrapper} onPress={(e) => e.stopPropagation()}>
            <Image source={{ uri: selectedQR! }} style={styles.qrImage} resizeMode="contain" />
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setSelectedQR(null); activeQR.current = null; }}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal 
        visible={selectedOrderItems !== null} 
        transparent 
        animationType="none"
        onRequestClose={() => setSelectedOrderItems(null)}
      >
        <Pressable style={styles.detailsModalContainer} onPress={() => setSelectedOrderItems(null)}>
          <Pressable style={styles.detailsModalWrapper} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <View style={styles.detailsDivider} />
            <ScrollView style={{ width: '100%', maxHeight: 300 }}>
              {selectedOrderItems?.map((item: any, index: number) => (
                <View key={index} style={styles.detailsItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailsItemName}>{item.itmdes}</Text>
                    <Text style={styles.detailsItemQty}>Qty: {item.pqty}</Text>
                  </View>
                  <Text style={styles.detailsItemPrice}>₹{item.itot}.00</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrderItems(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={styles.modalContainer} onPress={() => setShowSettings(false)}>
          <Pressable style={styles.settingsWrapper} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Max Brightness for QR Codes?</Text>
            <Text style={styles.modalDesc}>
              Do you want to automatically set your screen brightness to maximum when displaying your QR code?
            </Text>
            <Text style={styles.modalWarning}>
              Platform Limitation:{'\n'}
              This feature only works when installed as an app (APK/IPA). It will not work when opened in a web browser or PWA.
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0', flex: 1, marginRight: 8, opacity: !autoBrightness ? 0.5 : 1 }]} 
                onPress={() => {
                  setBrightnessPref(false);
                  setAutoBrightness(false);
                  setShowSettings(false);
                }}
                disabled={!autoBrightness}
              >
                <Text style={[styles.modalBtnText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{!autoBrightness ? 'Disabled' : 'Disable'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { flex: 1, marginLeft: 8, opacity: autoBrightness ? 0.5 : 1 }]} 
                onPress={async () => {
                  setBrightnessPref(true);
                  setAutoBrightness(true);
                  setShowSettings(false);
                }}
                disabled={autoBrightness}
              >
                <Text style={styles.modalBtnText}>{autoBrightness ? 'Enabled' : 'Enable'}</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS !== 'web' && (
              <TouchableOpacity 
                style={[styles.modalBtn, { marginTop: 12, backgroundColor: '#3B82F6', width: '100%' }]}
                onPress={async () => {
                  try {
                    const Updates = await import('expo-updates');
                    const update = await Updates.checkForUpdateAsync();
                    if (update.isAvailable) {
                      await Updates.fetchUpdateAsync();
                      await Updates.reloadAsync();
                    } else {
                      alert("No updates available! You are on the latest version.");
                    }
                  } catch (e: any) {
                    alert("Error checking for updates: " + e.message);
                  }
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Check for OTA Update</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setShowSettings(false)}>
              <Text style={{ color: isDark ? '#94A3B8' : '#64748B' }}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#121212' : '#F1F5F9' },
  list: { padding: 16 },
  orderCard: {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#334155' : '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  dateText: { color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 16, fontWeight: 'bold' },
  statusSuccess: { color: '#10B981', fontWeight: 'bold' },
  statusFailed: { color: '#EF4444', fontWeight: 'bold' },
  statusPending: { color: '#F59E0B', fontWeight: 'bold' },
  itemText: { color: isDark ? '#94A3B8' : '#475569', fontSize: 14, marginBottom: 4 },
  totalText: { color: isDark ? '#2563EB' : '#1D4ED8', fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  qrBtn: {
    backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  qrBtnText: { color: '#FFFFFF', fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  detailsBtn: {
    backgroundColor: isDark ? '#334155' : '#E2E8F0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  detailsBtnText: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  detailsModalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrWrapper: {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  qrImage: { 
    width: '100%', 
    aspectRatio: 1,
    marginBottom: 24,
  },
  closeBtn: { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', padding: 12, borderRadius: 8, minWidth: 120, alignItems: 'center' },
  closeBtnText: { color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: 'bold' },
  emptyText: { color: isDark ? '#94A3B8' : '#475569', textAlign: 'center', marginTop: 40 },
  settingsWrapper: {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDark ? '#F8FAFC' : '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 16,
    color: isDark ? '#94A3B8' : '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalWarning: {
    fontSize: 14,
    color: '#EF4444',
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
  },
  modalBtn: {
    backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsModalWrapper: {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  detailsDivider: {
    width: '100%',
    height: 1,
    backgroundColor: isDark ? '#334155' : '#E2E8F0',
    marginVertical: 16,
  },
  detailsItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  detailsItemName: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailsItemQty: {
    color: isDark ? '#94A3B8' : '#64748B',
    fontSize: 13,
  },
  detailsItemPrice: {
    color: isDark ? '#38BDF8' : '#0EA5E9',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
