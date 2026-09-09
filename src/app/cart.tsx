import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, getSession, getCart, updateCart, clearCart } from '../utils/api';
import { useAppTheme } from '../utils/ThemeContext';

export default function CartScreen() {
  const { isDark } = useAppTheme();
  const styles = getStyles(isDark);
  const router = useRouter();
  const [cart, setCart] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setCart(getCart());
    }, [])
  );

  const cartItems = Object.values(cart);
  const cartTotalItems = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const cartTotalPrice = cartItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rt), 0);

  const addToCart = (item: any) => {
    const newCart = { ...cart };
    const current = newCart[item.pid] || { ...item, quantity: 0 };
    
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

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const session = getSession();
      if (!session.pin) {
        alert('Authentication Error: PIN is missing. Please log out and log in again.');
        setLoading(false);
        return;
      }

      if (cartTotalItems === 0) {
        alert('Your cart is empty! Add some items before checking out.');
        setLoading(false);
        return;
      }

      const balanceRes = await api.getBalance(session.regNo);
      if (balanceRes && balanceRes[0] && balanceRes[0].bal !== undefined) {
        const currentBalance = parseFloat(balanceRes[0].bal);
        if (cartTotalPrice > currentBalance) {
          alert('You do not have enough funds for this order.');
          setLoading(false);
          return;
        }
      } else {
        alert('Could not verify your account balance. Please try again.');
        setLoading(false);
        return;
      }

      // Step 1: Get Order ID Details
      // Ensure all items have the required metadata (in case of old cart state)
      const missingMetadata = cartItems.some((c: any) => !c.skid || !c.tb);
      if (missingMetadata) {
        alert('Cart contains outdated items. Please clear your cart and add them again.');
        setLoading(false);
        return;
      }

      const orderData = await api.getOrderDetails(session.internalId, '1');
      if (!orderData || !Array.isArray(orderData) || orderData.length === 0) {
        throw new Error('Failed to generate order ID');
      }
      const orderNo = orderData[0].OrderNo || orderData[0].OrderNumber;

      // Step 2: Insert Items
      const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const currentDay = dayNames[new Date().getDay()];
      
      const date = new Date();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateStr = `${date.getDate().toString().padStart(2, '0')}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
      
      const insertPayload = {
        items: cartItems.map((c: any) => ({
          productId: `${c.skid}_${c.pid}_${c.tb}`,
          quantity: c.quantity,
          ides: c.ides,
          rt: c.rt,
          amt: c.rt * c.quantity,
          tp: c.type || "P",
          odt: dateStr,
          odtdes: currentDay, // Day of the week is sent as odtdes
          tb: c.tb,
          pid: c.pid,
          dtstr: dateStr,
          ldes: c.ldes || "",
          cal: "",
          sname: c.sname,
          skid: c.skid?.toString(),
          flag: 1,
          optcls: ""
        })),
        OrderNumber: orderNo,
        TableNo: "1",
        ItemTotal: cartTotalPrice.toString() + ".00",
        OutLetId: "2",
        MobileNo: session.internalId,
        RefNo: ""
      };
      
      const insertRes = await api.placeOrder(insertPayload);
      if (insertRes == 0 || insertRes === '0') {
        throw new Error('Failed to insert items into order');
      }

      // Step 3: OnlineWPayment
      const paymentPayload = {
        MobileNo: session.internalId,
        OrderNumber: orderNo,
        OrderAmount: cartTotalPrice.toString() + ".00",
        ouid: '2',
        Otp: session.pin,
        p1: session.regNo
      };
      
      const payRes = await api.payOrder(paymentPayload);
      
      if (typeof payRes === 'string' && payRes.startsWith('1|')) {
        // Background sync to ensure offline availability immediately
        api.getOrderHistory(session.internalId)
          .then((res) => {
            if (Array.isArray(res)) {
              res.forEach((order: any) => {
                if (order.Status === 'Success' || order.status === 'Success') {
                  const oid = (order.OrderId || order.OrderNumber || order.orderId || '').toString();
                  if (oid) api.getQRData(oid).catch(() => {});
                }
              });
            }
          })
          .catch(() => {});

        clearCart();
        setSuccess(true);
      } else {
        throw new Error('Payment failed or invalid PIN');
      }
      
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'An unexpected error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>Order Placed!</Text>
        <Text style={styles.successSub}>Your food is being prepared.</Text>
        <TouchableOpacity 
          style={styles.doneBtn} 
          onPress={() => router.replace('/history')}
        >
          <Text style={styles.doneBtnText}>View QR Code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cartItems.map((item: any) => (
          <View key={item.pid} style={styles.cartItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.ides}</Text>
              <Text style={styles.itemPrice}>₹{item.rt}.00</Text>
            </View>
            <View style={styles.qtyContainer}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item)}>
                <Text style={styles.qtyText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                <Text style={styles.qtyText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.divider} />
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>₹{cartTotalPrice}.00</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => setShowConfirm(true)} disabled={loading || cartTotalItems === 0}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkoutText}>Pay ₹{cartTotalPrice}.00</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => !loading && setShowConfirm(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !loading && setShowConfirm(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Confirm Order</Text>
            <Text style={styles.modalDesc}>
              Are you sure you want to place this order for ₹{cartTotalPrice}.00?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0', flex: 1, marginRight: 8 }]} 
                onPress={() => setShowConfirm(false)}
                disabled={loading}
              >
                <Text style={[styles.modalBtnText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { flex: 1, marginLeft: 8, opacity: loading ? 0.7 : 1 }]} 
                onPress={handleCheckout}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Yes</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#121212' : '#F1F5F9' },
  scroll: { padding: 24 },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  itemName: { fontSize: 18, color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: '600' },
  itemPrice: { fontSize: 16, color: isDark ? '#38BDF8' : '#1D4ED8', fontWeight: 'bold', marginTop: 4 },
  itemInfo: { flex: 1 },
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  qtyValue: {
    color: isDark ? '#F8FAFC' : '#0F172A',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  divider: { height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0', marginVertical: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 20, color: isDark ? '#94A3B8' : '#475569' },
  totalPrice: { fontSize: 24, color: isDark ? '#38BDF8' : '#1D4ED8', fontWeight: 'bold' },
  footer: { padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#E2E8F0' },
  checkoutBtn: {
    backgroundColor: isDark ? '#2563EB' : '#1D4ED8',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  successEmoji: { fontSize: 80, marginBottom: 20 },
  successTitle: { fontSize: 32, fontWeight: 'bold', color: isDark ? '#fff' : '#0F172A', marginBottom: 8 },
  successSub: { fontSize: 16, color: isDark ? '#94A3B8' : '#475569', marginBottom: 40 },
  doneBtn: { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' },
  doneBtnText: { color: isDark ? '#38BDF8' : '#1D4ED8', fontSize: 16, fontWeight: 'bold' },
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
