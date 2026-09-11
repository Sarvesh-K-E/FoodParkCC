import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let sessionData = {
  regNo: '',
  internalId: '',
  logId: '',
  name: '',
  outLetId: '2',
  pin: '',
};

export const loadSessionAsync = async () => {
  try {
    const stored = await AsyncStorage.getItem('sessionData');
    if (stored) {
      sessionData = JSON.parse(stored);
      return true;
    }
  } catch (e) {
    console.error('Failed to load session from storage', e);
  }
  return false;
};

export const setSession = async (regNo: string, internalId: string, logId: string, name: string = '', pin: string = '') => {
  sessionData.regNo = regNo;
  sessionData.internalId = internalId;
  sessionData.logId = logId;
  if (name) sessionData.name = name;
  if (pin) sessionData.pin = pin;
  
  try {
    await AsyncStorage.setItem('sessionData', JSON.stringify(sessionData));
  } catch (e) {
    console.error('Failed to save session to storage', e);
  }
};

export const clearSessionAsync = async () => {
  sessionData = { regNo: '', internalId: '', logId: '', name: '', outLetId: '2', pin: '' };
  globalCart = {};
  try {
    const keysToKeep = ['showBrightnessPrompt', 'autoBrightness'];
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(k => !keysToKeep.includes(k) && !k.startsWith('cache_'));
    await AsyncStorage.multiRemove(keysToRemove);
  } catch(e) {}
};

export const setPromptFlag = async () => AsyncStorage.setItem('showBrightnessPrompt', 'true').catch(()=>{});
export const getAndClearPromptFlag = async () => {
  try {
    const val = await AsyncStorage.getItem('showBrightnessPrompt');
    if (val === 'true') {
      await AsyncStorage.removeItem('showBrightnessPrompt');
      return true;
    }
  } catch(e) {}
  return false;
};

export const getBrightnessPref = async () => {
  try {
    const pref = await AsyncStorage.getItem('autoBrightness');
    return pref === 'true'; // Default is false unless explicitly true
  } catch(e) {}
  return false;
};

export const setBrightnessPref = async (val: boolean) => {
  try {
    await AsyncStorage.setItem('autoBrightness', val ? 'true' : 'false');
  } catch(e) {}
};

export const getIncludeTodayPref = async () => {
  try {
    const pref = await AsyncStorage.getItem('includeToday');
    return pref !== 'false'; // Default is true unless explicitly false
  } catch(e) {}
  return true;
};

export const setIncludeTodayPref = async (val: boolean) => {
  try {
    await AsyncStorage.setItem('includeToday', val ? 'true' : 'false');
  } catch(e) {}
};

export const getSession = () => sessionData;

let globalCart: any = {};
let globalMenuCache: any = {};

export const getCart = () => globalCart;
export const updateCart = (newCart: any) => { globalCart = newCart; };
export const clearCart = () => { globalCart = {}; globalMenuCache = {}; };

const BASE_URL = Platform.OS === 'web' 
  ? 'https://foodparkcc.fpcc.workers.dev'
  : 'https://vit-proodle.expertsoftsys.com';

const CACHEABLE_ENDPOINTS = [
  '/api/getstudWBalinfo', 
  '/api/GetOrderList', 
  '/api/orderQR'
];

const isCacheable = (endpoint: string) => {
  return CACHEABLE_ENDPOINTS.some(e => endpoint.includes(e));
};

const request = async (endpoint: string, data: any = null, method = 'POST', onCachedData?: (data: any) => void) => {
  const url = `${BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
  };

  const cacheKey = `cache_${endpoint}_${data ? JSON.stringify(data) : 'none'}`;

  // Instantly return cache if callback provided
  if (onCachedData && isCacheable(endpoint)) {
    AsyncStorage.getItem(cacheKey).then(cached => {
      if (cached) {
        try { onCachedData(JSON.parse(cached)); } catch(e) { onCachedData(cached); }
      }
    }).catch(() => {});
  }

  if (data && method === 'POST') {
    if (typeof data === 'string') {
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    options.signal = controller.signal as any;

    const response = await fetch(url, options);
    clearTimeout(id);
    
    const text = await response.text();
    
    // Proodle returns HTML strings on 500 Internal Server errors.
    // We MUST throw an error here so the cache fallback is triggered!
    if (!response.ok || text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
      throw new Error(`Server returned invalid response: ${response.status}`);
    }
    
    if (isCacheable(endpoint)) {
      AsyncStorage.setItem(cacheKey, text).catch(() => {});
    }
    
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
  } catch (error) {
    if (isCacheable(endpoint)) {
      console.warn(`API Error on ${endpoint}, falling back to cache if available`);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch(e) {
            return cached;
          }
        }
      } catch(e) {}
    }
    
    if (error?.name === 'AbortError' || (error?.message && error.message.includes('abort'))) {
      throw new Error("Network timeout: The server took too long to respond. Please check your connection.");
    }
    
    throw error;
  }
};

export const api = {
  login: (mobileNo: string, otpNo: string) => request('/api/GetOTPChecking', { MobileNo: mobileNo, OtpNo: otpNo }),
  getQRData: (orderId: string, onCachedData?: (data: any) => void) => request(`/api/orderQR?ordno=${orderId}`, null, 'GET', onCachedData),
  logout: (mobileNo: string) => request('/api/ulogout', { mobno: mobileNo }),
  checkSession: (mobileNo: string, logId: string) => request('/api/chkuserstat', { mobno: mobileNo, logid: logId }),
  getBalance: (regNo: string) => request(`/api/getstudWBalinfo?rno=${regNo}`, null, 'GET'),
  getMenu: async (sessionNo: string, internalId: string, dateStr: string) => {
    const cacheKey = `menu_${sessionNo}_${dateStr}`;
    if (globalMenuCache[cacheKey]) return globalMenuCache[cacheKey];
    
    const res = await request('/api/GetOptionMenuItems', { DocumentNo: '6', SessionNo: sessionNo, mobno: internalId, flg: '2', oid: '2', odt: dateStr });
    if (res && Array.isArray(res) && res.length > 0) {
      globalMenuCache[cacheKey] = res;
    }
    return res;
  },
  getOrderHistory: (internalId: string, onCachedData?: (data: any) => void) => request('/api/GetOrderList', `{MobileNo:'${internalId}'}`, 'POST', onCachedData),
  getOrderItems: (orderId: string) => request('/api/GetStudordItemdet', `{MobileNo:'${orderId}'}`, 'POST'),
  getOrderDetails: (mobileNo: string, tableNo: string = '1') => request('/api/GetOrderIdDetails', { MobileNo: mobileNo, TableNo: tableNo }),
  placeOrder: (payload: any) => request('/api/GetOutletListInsert', payload),
  payOrder: (payload: any) => request('/api/OnlineWPayment', payload)
};
