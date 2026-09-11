import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput, Platform, Pressable, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, getSession, setSession, getCart, updateCart, clearSessionAsync, getAndClearPromptFlag, setBrightnessPref, getIncludeTodayPref, setIncludeTodayPref } from '../utils/api';
import { useAppTheme } from '../utils/ThemeContext';
import CustomSwitch from '../components/CustomSwitch';
import NetInfo from '@react-native-community/netinfo';
import { Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';

const SESSIONS = [
  { id: '1', title: 'Breakfast' },
  { id: '2', title: 'Lunch' },
  { id: '3', title: 'Snacks' },
  { id: '4', title: 'Dinner' }
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];



export default function HomeScreen() {
  const { isDark, toggleTheme } = useAppTheme();
  const styles = getStyles(isDark);
  const router = useRouter();
  const [balance, setBalance] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [showBrightnessPrompt, setShowBrightnessPrompt] = useState(false);
  const [includeToday, setIncludeToday] = useState(true);
  const [showBalancePref, setShowBalancePref] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await clearSessionAsync();
    router.replace('/');
  };



  const fetchBalance = useCallback(async () => {
    try {
      const session = getSession();
      const res = await api.getBalance(session.regNo);
      
      if (Array.isArray(res) && res.length > 0) {
        setBalance(`₹${res[0].bal}.00`);
        setSession(session.regNo, session.internalId, session.logId, res[0].name, session.pin);
      } else {
        setBalance('₹0.00');
      }
    } catch (e) {
      console.error(e);
      setBalance('₹0.00');
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setCart(getCart());
      fetchBalance();
    }, [fetchBalance])
  );

  const fetchMenu = useCallback(async (sessionNo: string, isPullToRefresh = false) => {
    if (!isPullToRefresh) setLoadingItems(true);
    try {
      const session = getSession();
      const date = new Date();
      const dateStr = `${date.getDate().toString().padStart(2, '0')}-${MONTH_NAMES[date.getMonth()]}-${date.getFullYear()}`;
      
      const res = await api.getMenu(sessionNo, session.internalId, dateStr);
      
      if (res && Array.isArray(res)) {
        setItems(res.map(item => ({
          ...item,
          pid: (item.meitid || item.pid)?.toString(),
          ides: item.meitdes || item.ides || item.dispname,
          rt: item.retrt || item.rt,
          skid: item.skuid,
          tb: item.tb,
          sname: item.odtdes,
          type: item.type,
          dtstr: item.dtstr,
          ldes: item.dispname,
          stockQty: item.StockQty !== undefined ? item.StockQty : 999,
          img: `https://vit-proodle.expertsoftsys.com/images/${item.meitid || item.pid}.jpg`
        })));
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // =========================================================================
  // ALGORITHM: Network-Based Concurrent Session Detection (Commented Out)
  // =========================================================================
  // This algorithm queries all 4 sessions concurrently to find the first one 
  // that returns a non-empty menu. It is highly accurate but slower than local 
  // time checks. Kept here for reference in case Proodle's timings change unpredictably.
  /*
  const findActiveSession = async () => {
    const session = getSession();
    const date = new Date();
    const dateStr = `${date.getDate().toString().padStart(2, '0')}-${MONTH_NAMES[date.getMonth()]}-${date.getFullYear()}`;
    
    return new Promise<string>((resolve) => {
      let completed = 0;
      let resolved = false;

      const checkSession = async (sessionNo: string) => {
        try {
          const res = await api.getMenu(sessionNo, session.internalId, dateStr);
          if (!resolved && Array.isArray(res) && res.length > 0) {
            resolved = true;
            resolve(sessionNo);
          }
        } catch (e) {
        } finally {
          completed++;
          if (completed === 4 && !resolved) resolve('1');
        }
      };

      checkSession('1');
      checkSession('2');
      checkSession('3');
      checkSession('4');
    });
  };
  */

  // =========================================================================
  // ALGORITHM: Instant Local Time-Based Session Detection
  // =========================================================================
  // Mathematically deduces the current active dining session instantly based on device time.
  const getInstantActiveSession = () => {
    const hour = new Date().getHours();
    if (hour < 11) return '1'; // Midnight - 10:59 AM (Breakfast)
    if (hour < 15) return '2'; // 11:00 AM - 2:59 PM (Lunch)
    if (hour < 18) return '3'; // 3:00 PM - 5:59 PM (Snacks)
    return '4';                // 6:00 PM - 11:59 PM (Dinner)
  };

  useEffect(() => {
    const checkPrompt = async () => {
      const shouldPrompt = await getAndClearPromptFlag();
      if (shouldPrompt) {
        setShowBrightnessPrompt(true);
      }
    };
    checkPrompt();
    getIncludeTodayPref().then(pref => setIncludeToday(pref));
    fetchBalance();
    const init = async () => {
      setLoadingItems(true);
      const target = getInstantActiveSession();
      setSelectedSession(target);
      await fetchMenu(target, true);
      setInitialLoadDone(true);
    };
    init();
  }, [fetchBalance]);



  const onRefresh = async () => {
    setRefreshing(true);
    setBalance(null);
    await Promise.all([
      fetchBalance(),
      fetchMenu(selectedSession || '1', true)
    ]);
    setRefreshing(false);
  };

  const handleReload = async () => {
    if (isReloading) return;
    setIsReloading(true);
    setBalance(null);
    setLoadingItems(true); // Instantly clear list to show spinner without waiting for fetch
    
    // Yield to the browser so it can paint the loading spinner before we start heavy fetching
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Add a minimum visual delay so the spinner doesn't flash instantly and look glitchy
    const minDelay = new Promise(resolve => setTimeout(resolve, 400));
    
    await Promise.all([
      fetchBalance(),
      fetchMenu(selectedSession || '1', false),
      minDelay
    ]);
    
    setIsReloading(false);
  };

  const addToCart = (item: any) => {
    const newCart = { ...cart };
    const current = newCart[item.pid] || { ...item, quantity: 0 };
    
    // Honor the frontend limit if explicitly set by backend (below 999)
    if (item.stockQty !== undefined && item.stockQty < 999 && current.quantity >= item.stockQty) {
      alert(`Limit reached: You cannot add more than ${item.stockQty} of this item.`);
      return;
    }
    
    newCart[item.pid] = { ...current, quantity: current.quantity + 1 };
    setCart(newCart);
    updateCart(newCart);
  };

  const removeFromCart = (item: any) => {
    const newCart = { ...cart };
    const current = newCart[item.pid];
    if (!current || current.quantity === 0) return;
    
    if (current.quantity === 1) {
      delete newCart[item.pid];
    } else {
      newCart[item.pid] = { ...current, quantity: current.quantity - 1 };
    }
    setCart(newCart);
    updateCart(newCart);
  };

  const cartTotalItems = Object.values(cart).reduce((sum: number, item: any) => sum + item.quantity, 0);
  const cartTotalPrice = Object.values(cart).reduce((sum: number, item: any) => sum + (item.quantity * item.rt), 0);

  // Calculate daily allowance based on remaining days in month
  const numericBalance = parseFloat(balance?.replace(/[^0-9.]/g, '') || '0');
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - currentDay + (includeToday ? 1 : 0);
  const dailyAllowance = balance ? (numericBalance > 0 && remainingDays > 0 ? (numericBalance / remainingDays).toFixed(2) : '0.00') : '0.00';

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topSection}>
        <View style={styles.topLeft}>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.username} numberOfLines={1}>
            {getSession().name || 'Student'}
          </Text>
        </View>
        <TouchableOpacity style={styles.balanceContainer} onPress={() => setShowBalancePref(true)}>
          <Text style={styles.balanceValue}>{balance !== null ? balance : 'Loading...'}</Text>
          <Text style={styles.dailyAllowanceText}>₹{dailyAllowance}/day</Text>
          <Text style={styles.dailyAllowanceSubText}>({remainingDays}d left in {MONTH_NAMES[today.getMonth()]})</Text>
          <Text style={styles.dailyAllowancePrefText}>{includeToday ? 'Including Today' : 'Excluding Today'}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.actionsRow}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/history')}>
            <Text style={styles.historyBtnText}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.themeToggleContainer}>
          <TouchableOpacity onPress={handleReload} disabled={isReloading} style={{ marginRight: 12, opacity: isReloading ? 0.5 : 1 }}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#94A3B8' : '#475569'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <Path d="M21 3v5h-5" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.themeLabel}>{isDark ? 'Dark' : 'Light'}</Text>
          <CustomSwitch value={isDark} onValueChange={toggleTheme} isDark={isDark} />
        </View>
      </View>

      <View style={styles.tabsContainer}>
        {SESSIONS.map(session => (
          <TouchableOpacity 
            key={session.id} 
            style={[styles.tab, selectedSession === session.id && styles.activeTab]}
            onPress={() => {
              if (selectedSession !== session.id) {
                setSelectedSession(session.id);
                fetchMenu(session.id);
              }
            }}
            disabled={!initialLoadDone}
          >
            <Text style={[styles.tabText, selectedSession === session.id && styles.activeTabText]}>
              {session.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const qty = cart[item.pid]?.quantity || 0;
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.img }} style={styles.image} />
        <View style={styles.cardInfo}>
          <Text style={styles.itemName}>{item.ides}</Text>
          {item.ldes ? <Text style={styles.itemSubName}>{item.ldes}</Text> : null}
          {item.skudes ? <Text style={styles.itemStall}>Stall: {item.skudes}</Text> : null}
          <Text style={styles.itemPrice}>₹{item.rt}.00</Text>
          {item.stockQty > 0 && item.stockQty < 999 && (
            <Text style={styles.itemStock}>{item.stockQty} left in stock</Text>
          )}
        </View>
        <View style={styles.actionContainer}>
          {item.stockQty <= 0 ? (
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          ) : qty > 0 ? (
            <View style={styles.qtyContainer}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item)}>
                <Text style={styles.qtyText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{qty}</Text>
              <TouchableOpacity 
                style={styles.qtyBtn} 
                onPress={() => addToCart(item)}
              >
                <Text style={styles.qtyText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
              <Text style={styles.addText}>ADD</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (!initialLoadDone) return null;
    if (loadingItems) return <ActivityIndicator color="#0EA5E9" size="large" style={{ marginTop: 40 }} />;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Session not started</Text>
      </View>
    );
  };

  const filteredItems = items.filter(item => item.ides?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.offlineText}>Offline - Using saved data</Text>
        </View>
      )}
      {renderHeader()}
      
      {isOffline ? (
        <View style={styles.offlineStateContainer}>
          <Ionicons name="wifi-outline" size={64} color={isDark ? '#475569' : '#94A3B8'} />
          <Text style={styles.offlineStateText}>
            You are currently offline. You can still view your balance and past orders, but the menu is unavailable.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.searchContainer}>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search menu" 
              placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loadingItems || !initialLoadDone ? (
            <ActivityIndicator color="#0EA5E9" size="large" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item, index) => (item.pid || item.meitid || index).toString()}
              renderItem={renderItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Session not started</Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
              ListFooterComponent={
                <View style={styles.footerContainer}>
                  <View style={styles.footerDivider} />
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
              }
            />
          )}
        </>
      )}

      {cartTotalItems > 0 && (
        <TouchableOpacity 
          style={styles.cartBar} 
          onPress={() => router.push('/cart')}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.cartItemsText}>{cartTotalItems} Item{cartTotalItems > 1 ? 's' : ''}</Text>
            <Text style={styles.cartPriceText} numberOfLines={1} adjustsFontSizeToFit>₹{cartTotalPrice}.00</Text>
          </View>
          <View style={styles.cartCheckoutBtn}>
            <Text style={styles.cartCheckoutText}>View Cart ➔</Text>
          </View>
        </TouchableOpacity>
      )}

      <Modal visible={showBrightnessPrompt} transparent animationType="fade" onRequestClose={() => setShowBrightnessPrompt(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBrightnessPrompt(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Max Brightness for QR Codes?</Text>
            <Text style={styles.modalDesc}>
              Do you want to automatically set your screen brightness to maximum when displaying your QR code?
            </Text>
            <Text style={styles.modalWarning}>
              Platform Limitation:{'\n'}
              This feature only works when installed as an app (APK/IPA). It will not work when opened in a web browser.
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0', flex: 1, marginRight: 8 }]} 
                onPress={() => {
                  setBrightnessPref(false);
                  setShowBrightnessPrompt(false);
                }}
              >
                <Text style={[styles.modalBtnText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>No, Thanks</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { flex: 1, marginLeft: 8 }]} 
                onPress={async () => {
                  setBrightnessPref(true);
                  setShowBrightnessPrompt(false);
                }}
              >
                <Text style={styles.modalBtnText}>Enable</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={showBalancePref} transparent animationType="fade" onRequestClose={() => setShowBalancePref(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBalancePref(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Daily Allowance Calculation</Text>
            <Text style={styles.modalDesc}>
              Do you want to include today in the remaining days calculation?
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0', flex: 1, marginRight: 8, opacity: !includeToday ? 0.5 : 1 }]} 
                onPress={() => {
                  setIncludeTodayPref(false);
                  setIncludeToday(false);
                  setShowBalancePref(false);
                }}
                disabled={!includeToday}
              >
                <Text style={[styles.modalBtnText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Exclude Today</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { flex: 1, marginLeft: 8, opacity: includeToday ? 0.5 : 1 }]} 
                onPress={() => {
                  setIncludeTodayPref(true);
                  setIncludeToday(true);
                  setShowBalancePref(false);
                }}
                disabled={includeToday}
              >
                <Text style={styles.modalBtnText}>Include Today</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#121212' : '#F8FAFC',
  },
  headerContainer: {
    paddingTop: 30,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topLeft: {
    flex: 1,
    marginRight: 6,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '400',
    color: isDark ? '#94A3B8' : '#475569',
  },
  username: {
    fontSize: 20,
    fontWeight: '800',
    color: isDark ? '#F8FAFC' : '#0F172A',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceContainer: {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
    alignItems: 'flex-end',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: isDark ? '#38BDF8' : '#1D4ED8',
  },
  dailyAllowanceText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    color: isDark ? '#38BDF8' : '#1D4ED8',
  },
  dailyAllowanceSubText: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
    color: isDark ? '#38BDF8' : '#1D4ED8',
  },
  dailyAllowancePrefText: {
    fontSize: 8,
    fontWeight: '500',
    marginTop: 3,
    color: isDark ? '#94A3B8' : '#64748B',
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#94A3B8' : '#475569',
    marginRight: 4,
  },
  historyBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
    marginRight: 8,
  },
  historyBtnText: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: isDark ? '#0F172A' : '#E2E8F0',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
  },
  tabText: {
    color: isDark ? '#94A3B8' : '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 14,
  },
  footerContainer: {
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  footerDivider: {
    width: '80%',
    height: 1,
    backgroundColor: isDark ? '#334155' : '#CBD5E1',
    marginBottom: 20,
  },
  linksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
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
  },
  listContent: {
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#F8FAFC' : '#0F172A',
  },
  itemSubName: {
    fontSize: 12,
    color: isDark ? '#94A3B8' : '#475569',
    marginTop: 2,
  },
  itemStall: {
    fontSize: 11,
    color: isDark ? '#38BDF8' : '#1D4ED8',
    marginTop: 2,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 14,
    color: isDark ? '#94A3B8' : '#475569',
    marginTop: 4,
  },
  itemStock: {
    fontSize: 11,
    color: isDark ? '#10B981' : '#059669',
    marginTop: 4,
    fontWeight: '600',
  },
  actionContainer: {
    width: 90,
    alignItems: 'flex-end',
  },
  addButton: {
    borderWidth: 1,
    borderColor: isDark ? '#2563EB' : '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  addText: {
    color: isDark ? '#2563EB' : '#1D4ED8',
    fontWeight: '600',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
    borderRadius: 8,
  },
  qtyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  qtyText: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qtyValue: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: isDark ? '#94A3B8' : '#475569',
    textAlign: 'center',
    fontSize: 16,
  },
  cartBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cartItemsText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
  },
  cartPriceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  cartCheckoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartCheckoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  outOfStockText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  signOutBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  signOutBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  offlineBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EF4444',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 100,
  },
  offlineText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  offlineStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  offlineStateText: {
    fontSize: 16,
    color: isDark ? '#94A3B8' : '#475569',
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
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
  }
});
