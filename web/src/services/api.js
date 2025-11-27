import axios from 'axios';

const apiClient = axios.create({ 
  baseURL: '/api'
  // Don't set default Content-Type, let axios handle it automatically for FormData
});

apiClient.interceptors.request.use((config)=>{
  const token = localStorage.getItem('token');
  console.log('API Request interceptor - token:', token ? 'present' : 'missing', 'URL:', config.url);
  if(token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Set Content-Type to application/json only for non-FormData requests
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}, (err)=>Promise.reject(err));

export const login = (playerid,password)=>apiClient.post('/auth/login',{playerid,password});
export const register = (playerid,password)=>apiClient.post('/auth/register',{playerid,password});
export const getMe = ()=>apiClient.get('/auth/me');
export const getProducts = ()=>apiClient.get('/products');
export const getProduct = (id)=>apiClient.get(`/products/${id}`);
export const getCart = ()=>apiClient.get('/cart');
export const addToCart = (productId,quantity)=>apiClient.post('/cart',{productId,quantity});
export const updateCartItem = (cartItemId,quantity)=>apiClient.put(`/cart/${cartItemId}`,{quantity});
export const removeFromCart = (cartItemId)=>apiClient.delete(`/cart/${cartItemId}`);
export const checkout = (payload)=>apiClient.post('/orders/checkout',payload);
export const getOrders = ()=>apiClient.get('/orders');
export const getOrder = (id)=>apiClient.get(`/orders/${id}`);
export const uploadProof = (orderId,formData)=>apiClient.post(`/orders/${orderId}/upload_proof`,formData,{headers:{'Content-Type':'multipart/form-data'}});
export const uploadPaymentProof = (file)=>{
  const fd = new FormData()
  fd.append('file', file)
  return apiClient.post('/uploads/payment-proof', fd, { headers: {'Content-Type':'multipart/form-data'} })
}
export const adminGetOrders = ()=>apiClient.get('/admin/orders');
export const adminApproveOrder = (id)=>apiClient.post(`/admin/orders/${id}/approve`);
export const adminRejectOrder = (id)=>apiClient.post(`/admin/orders/${id}/reject`);
export const getPaymentMethods = ()=>apiClient.get('/payment-methods');
export const updateProduct = (id, formData)=>apiClient.put(`/products/${id}`, formData, {headers:{'Content-Type':'multipart/form-data'}});
export const toggleProductStatus = (id, active)=>apiClient.put(`/products/${id}`, {active});

// Currency API
export const getCurrencyConfig = ()=>apiClient.get('/currency/config');

// PayPal API
export const getPayPalConfig = ()=>apiClient.get('/paypal/config');
export const createPayPalOrder = (currency)=>apiClient.post('/paypal/create-order', { currency });
export const capturePayPalOrder = (orderID, discordId)=>apiClient.post('/paypal/capture-order', {orderID, discordId});

// Stripe API
export const getStripeConfig = ()=>apiClient.get('/stripe/config');
export const createStripePaymentIntent = (currency)=>apiClient.post('/stripe/create-payment-intent', { currency });
export const confirmStripePayment = (paymentIntentId, discordId)=>apiClient.post('/stripe/confirm-payment', {paymentIntentId, discordId});

// ECPay API
export const getECPayConfig = ()=>apiClient.get('/ecpay/config');
export const createECPayPayment = (paymentType, discordId, currency)=>apiClient.post('/ecpay/create-payment', { paymentType, discordId, currency });

export default apiClient;
