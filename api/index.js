
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const Rcon = require('rcon-client').Rcon;
const jwt = require('jsonwebtoken');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');
const crypto = require('crypto');

const PORT = process.env.PORT || 18081;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'somesecret';

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool();

const upload = multer({
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Fallback: if an uploads file is requested but missing, serve from container's poc_res
app.get('/uploads/:file', (req, res) => {
  const file = req.params.file;
  const uploadsPath = path.join(__dirname, 'uploads', file);
  if (fs.existsSync(uploadsPath)) return res.sendFile(uploadsPath);
  const altPath = path.join(__dirname, 'poc_res', file);
  if (fs.existsSync(altPath)) return res.sendFile(altPath);
  res.status(404).end();
});

// Currency configuration
function getCurrencyConfig() {
  try {
    const configPath = path.join(__dirname, 'currency-config.json');
    if (!fs.existsSync(configPath)) {
      console.log('Currency config not found, using default TWD');
      return {
        currency: 'TWD',
        exchange_rates: { TWD_to_HKD: 0.2, HKD_to_TWD: 5 },
        symbols: { TWD: 'NT$', HKD: 'HK$' },
        stripe_minimum: { TWD: 2000, HKD: 400 }
      };
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.error('Currency config error:', e.message);
    return {
      currency: 'TWD',
      exchange_rates: { TWD_to_HKD: 0.2, HKD_to_TWD: 5 },
      symbols: { TWD: 'NT$', HKD: 'HK$' },
      stripe_minimum: { TWD: 2000, HKD: 400 }
    };
  }
}

// Convert price from TWD (database) to display currency
function convertPrice(twdPrice, targetCurrency) {
  const config = getCurrencyConfig();
  if (targetCurrency === 'TWD') {
    return parseFloat(twdPrice);
  }
  // Convert TWD to HKD
  if (targetCurrency === 'HKD') {
    return parseFloat(twdPrice) * config.exchange_rates.TWD_to_HKD;
  }
  // Fallback to original price
  return parseFloat(twdPrice);
}

// Convert price from display currency back to TWD (for database)
function convertToTWD(displayPrice, sourceCurrency) {
  const config = getCurrencyConfig();
  if (sourceCurrency === 'TWD' || config.currency === 'TWD') {
    return parseFloat(displayPrice);
  }
  // Convert HKD to TWD
  return parseFloat(displayPrice) * config.exchange_rates.HKD_to_TWD;
}

// Stripe configuration
let stripeInstance = null;
function getStripeClient() {
  try {
    if (stripeInstance) return stripeInstance;
    const configPath = path.join(__dirname, 'stripe-config.json');
    if (!fs.existsSync(configPath)) {
      console.log('Stripe config file not found');
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Check if keys are still placeholders
    if (!config.secret_key || 
        config.secret_key.includes('your_stripe_secret_key_here') ||
        config.secret_key === 'sk_test_' ||
        config.secret_key.length < 20) {
      console.log('Stripe not configured: Invalid secret key in stripe-config.json');
      return null;
    }
    
    const stripe = require('stripe')(config.secret_key);
    stripeInstance = stripe;
    console.log('Stripe initialized successfully');
    return stripe;
  } catch (e) {
    console.error('Stripe configuration error:', e.message);
    return null;
  }
}

// ECPay configuration
function getECPayConfig() {
  try {
    const configPath = path.join(__dirname, 'ecpay-config.json');
    if (!fs.existsSync(configPath)) {
      console.log('ECPay config file not found');
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  } catch (e) {
    console.error('ECPay configuration error:', e.message);
    return null;
  }
}

// ECPay helper functions
function generateECPayCheckMac(params, hashKey, hashIv) {
  // Sort parameters by key alphabetically (case-sensitive)
  const sortedKeys = Object.keys(params).sort();
  
  // Build parameter string (NO encoding at this stage)
  const sortedParams = sortedKeys.map(key => {
    return `${key}=${params[key]}`;
  }).join('&');
  
  // Add HashKey and HashIV
  let checkValue = `HashKey=${hashKey}&${sortedParams}&HashIV=${hashIv}`;
  
  console.log('[ECPay] Step 1 - Raw string:', checkValue);
  
  // URL encode the ENTIRE string once
  checkValue = encodeURIComponent(checkValue)
    .replace(/%2d/gi, '-')
    .replace(/%5f/gi, '_')
    .replace(/%2e/gi, '.')
    .replace(/%21/gi, '!')
    .replace(/%2a/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%20/g, '+');
  
  console.log('[ECPay] Step 2 - After URL encode:', checkValue);
  
  // Convert to lowercase
  checkValue = checkValue.toLowerCase();
  
  console.log('[ECPay] Step 3 - After lowercase:', checkValue);
  
  // Create SHA256 hash and convert to uppercase
  const hash = crypto.createHash('sha256').update(checkValue).digest('hex').toUpperCase();
  
  console.log('[ECPay] Step 4 - Final CheckMacValue:', hash);
  
  return hash;
}

// Get ECPay config for frontend
app.get('/ecpay/config', async (req, res) => {
  try {
    const config = getECPayConfig();
    if (!config) {
      return res.status(500).json({ error: 'ECPay not configured' });
    }
    res.json({ 
      enabled: true,
      test_mode: config.test_mode 
    });
  } catch (e) {
    res.status(500).json({ error: 'ECPay not configured' });
  }
});

// PayPal configuration
function getPayPalClient() {
  try {
    const configPath = path.join(__dirname, 'paypal-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const environment = config.mode === 'live' 
      ? new paypal.core.LiveEnvironment(config.client_id, config.client_secret)
      : new paypal.core.SandboxEnvironment(config.client_id, config.client_secret);
    return new paypal.core.PayPalHttpClient(environment);
  } catch (e) {
    console.error('PayPal configuration error:', e);
    return null;
  }
}

// Get PayPal client ID for frontend
app.get('/paypal/config', async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'paypal-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json({ client_id: config.client_id, mode: config.mode });
  } catch (e) {
    res.status(500).json({ error: 'PayPal not configured' });
  }
});

// Create PayPal order
app.post('/paypal/create-order', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const { currency: userCurrency } = req.body; // User selected currency from frontend
  const cart = (await pool.query('SELECT * FROM cart_items WHERE user_id=$1', [uid])).rows;
  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Empty cart' });
  
  const currencyConfig = getCurrencyConfig();
  // Use user's selected currency or fallback to config default
  const currency = userCurrency || currencyConfig.currency;
  
  // Calculate total from cart (prices stored in TWD)
  let totalTWD = 0;
  for (const item of cart) {
    const product = (await pool.query('SELECT price FROM products WHERE id=$1', [item.product_id])).rows[0];
    if (product) totalTWD += parseFloat(product.price) * item.quantity;
  }
  
  // Convert to display currency
  const displayTotal = convertPrice(totalTWD, currency);
  
  const client = getPayPalClient();
  if (!client) return res.status(500).json({ error: 'PayPal not configured' });
  
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: Math.round(displayTotal).toString()
      }
    }]
  });
  
  try {
    const order = await client.execute(request);
    res.json({ id: order.result.id });
  } catch (e) {
    console.error('PayPal order creation error:', e);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

// Capture PayPal payment and create orders
app.post('/paypal/capture-order', playerAuth, async (req, res) => {
  const { orderID, discordId } = req.body;
  const uid = req.user.uid;
  const playerid = req.user.playerid;
  
  if (!orderID) return res.status(400).json({ error: 'Missing orderID' });
  
  const client = getPayPalClient();
  if (!client) return res.status(500).json({ error: 'PayPal not configured' });
  
  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});
  
  try {
    const capture = await client.execute(request);
    
    // Check if payment was successful
    if (capture.result.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed' });
    }
    
    // Get cart items
    const cart = (await pool.query('SELECT * FROM cart_items WHERE user_id=$1', [uid])).rows;
    if (!cart || cart.length === 0) return res.status(400).json({ error: 'Empty cart' });
    
    // Generate unique order group ID for this checkout session
    const orderGroupId = crypto.randomUUID();
    
    const created = [];
    try {
      // Create orders and auto-approve since PayPal payment is confirmed
      for (const it of cart) {
        const product = (await pool.query('SELECT command, price FROM products WHERE id=$1', [it.product_id])).rows[0];
        
        // Create one order record for each quantity
        const quantity = parseInt(it.quantity) || 1;
        for (let i = 0; i < quantity; i++) {
          // Create order with PayPal payment method
          const r = await pool.query(
            'INSERT INTO orders(order_group_id, user_id, playerid, discord_id, product_id, status, payment_method, paypal_order_id, created_at, approved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),now()) RETURNING *',
            [orderGroupId, uid, playerid, discordId || null, it.product_id, 'approved', 'paypal', orderID]
          );
          
          const order = r.rows[0];
          created.push(order);
          
          // Execute RCON command automatically
          if (product && product.command) {
            const cmd = product.command.replace(/\{playerid\}/g, playerid);
            try {
              const resp = await runRconCommand(cmd);
              await pool.query('UPDATE orders SET rcon_result=$1 WHERE id=$2', [resp ? String(resp) : null, order.id]);
            } catch (e) {
              console.error('RCON execution error for order', order.id, e);
              // Continue even if RCON fails
            }
          }
        }
      }
      
      // Clear cart
      await pool.query('DELETE FROM cart_items WHERE user_id=$1', [uid]);
      
      res.json({ success: true, orders: created, id: created[0] ? created[0].id : null, orderGroupId });
    } catch (e) {
      console.error('Order creation failed', e);
      res.status(500).json({ error: 'Order creation failed' });
    }
  } catch (e) {
    console.error('PayPal capture error:', e);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

// Get Stripe publishable key for frontend
app.get('/stripe/config', async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'stripe-config.json');
    if (!fs.existsSync(configPath)) return res.status(404).json({ publishableKey: null });
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Check if publishable key is valid
    if (!config.publishable_key || 
        config.publishable_key.includes('your_stripe_publishable_key_here') ||
        config.publishable_key === 'pk_test_' ||
        config.publishable_key.length < 20) {
      return res.status(404).json({ publishableKey: null });
    }
    
    res.json({ publishableKey: config.publishable_key });
  } catch (e) {
    res.status(500).json({ error: 'Stripe not configured' });
  }
});

// Get currency configuration
app.get('/currency/config', async (req, res) => {
  const config = getCurrencyConfig();
  res.json({
    defaultCurrency: config.currency,
    supportedCurrencies: config.supported_currencies || ['TWD', 'HKD'],
    symbols: config.symbols,
    exchangeRates: config.exchange_rates,
    stripeMinimum: config.stripe_minimum
  });
});

// Create Stripe payment intent
app.post('/stripe/create-payment-intent', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const { currency: userCurrency } = req.body; // User selected currency from frontend
  const cart = (await pool.query('SELECT * FROM cart_items WHERE user_id=$1', [uid])).rows;
  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Empty cart' });
  
  const currencyConfig = getCurrencyConfig();
  // Use user's selected currency or fallback to config default
  const selectedCurrency = userCurrency || currencyConfig.currency;
  const currency = selectedCurrency.toLowerCase();
  const currencySymbol = currencyConfig.symbols[selectedCurrency];
  
  // Calculate total from cart (prices stored in TWD)
  let totalTWD = 0;
  for (const item of cart) {
    const product = (await pool.query('SELECT price FROM products WHERE id=$1', [item.product_id])).rows[0];
    if (product) totalTWD += parseFloat(product.price) * item.quantity;
  }
  
  // Convert to selected currency for payment
  const amountInCurrency = convertPrice(totalTWD, selectedCurrency);
  
  console.log(`[Stripe Payment Intent] Selected currency: ${selectedCurrency}`);
  console.log(`[Stripe Payment Intent] Total in TWD: ${totalTWD}`);
  console.log(`[Stripe Payment Intent] Amount in ${selectedCurrency}: ${amountInCurrency}`);
  
  // Calculate Stripe amount (in smallest currency unit)
  // Both TWD and HKD use 2 decimal places in Stripe API (100 units = 1 currency)
  const amount = Math.round(amountInCurrency * 100);
  
  console.log(`[Stripe Payment Intent] Stripe amount (smallest unit): ${amount}`);
  
  // Check minimum amount based on currency
  const minimumAmount = currencyConfig.stripe_minimum[selectedCurrency];
  if (amount < minimumAmount) {
    const minDisplay = minimumAmount / 100;
    return res.status(400).json({ 
      error: `Stripe 最低金額為 ${currencySymbol}${minDisplay}，您的購物車總額為 ${currencySymbol}${displayTotal.toFixed(2)}`,
      minimumAmount: minDisplay,
      currentAmount: displayTotal
    });
  }
  
  const stripe = getStripeClient();
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  
  // Read payment method types from config and filter based on currency
  let paymentMethodTypes = ['card']; // Default to card only
  try {
    const configPath = path.join(__dirname, 'stripe-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    if (config.payment_method_types && Array.isArray(config.payment_method_types)) {
      paymentMethodTypes = config.payment_method_types;
      
      // Filter payment methods based on currency support
      // Alipay and WeChat Pay do NOT support TWD
      if (selectedCurrency === 'TWD') {
        paymentMethodTypes = paymentMethodTypes.filter(method => 
          method !== 'alipay' && method !== 'wechat_pay'
        );
        console.log(`TWD currency: filtered payment methods to ${paymentMethodTypes.join(', ')}`);
      }
    }
  } catch (err) {
    console.warn('Could not read payment_method_types from stripe-config.json, using default [card]');
  }
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method_types: paymentMethodTypes,
      metadata: {
        user_id: uid.toString(),
        original_twd_amount: totalTWD.toString(),
      }
    });
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error('Stripe payment intent creation error:', e);
    
    // Handle amount_too_small error gracefully
    if (e.code === 'amount_too_small') {
      const minDisplay = minimumAmount / 100;
      return res.status(400).json({ 
        error: `Stripe 最低金額為 ${currencySymbol}${minDisplay}（由於匯率轉換限制），您的購物車總額為 ${currencySymbol}${amountInCurrency.toFixed(2)}。請使用手動上傳或 PayPal 付款。`,
        minimumAmount: minDisplay,
        currentAmount: amountInCurrency
      });
    }
    
    // Handle unsupported payment method errors
    if (e.code === 'parameter_invalid_empty' || e.message?.includes('payment_method_types')) {
      console.warn('Some payment methods not available, falling back to card only');
      // Retry with card only
      try {
        const fallbackIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'twd',
          payment_method_types: ['card'],
          metadata: { user_id: uid.toString() }
        });
        return res.json({ clientSecret: fallbackIntent.client_secret });
      } catch (fallbackError) {
        console.error('Fallback payment intent creation failed:', fallbackError);
      }
    }
    
    // Other Stripe errors
    res.status(500).json({ 
      error: 'Stripe 付款處理失敗，請嘗試其他付款方式或聯繫客服',
      technicalDetails: e.type === 'StripeInvalidRequestError' ? e.message : undefined
    });
  }
});

// Confirm Stripe payment and create orders
app.post('/stripe/confirm-payment', playerAuth, async (req, res) => {
  const { paymentIntentId, discordId } = req.body;
  const uid = req.user.uid;
  const playerid = req.user.playerid;
  
  if (!paymentIntentId) return res.status(400).json({ error: 'Missing paymentIntentId' });
  
  const stripe = getStripeClient();
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  
  try {
    // Retrieve payment intent to verify it's succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not succeeded' });
    }
    
    // Get cart items
    const cart = (await pool.query('SELECT * FROM cart_items WHERE user_id=$1', [uid])).rows;
    if (!cart || cart.length === 0) return res.status(400).json({ error: 'Empty cart' });
    
    // Generate unique order group ID for this checkout session
    const orderGroupId = crypto.randomUUID();
    
    const created = [];
    try {
      // Create orders and auto-approve since Stripe payment is confirmed
      for (const it of cart) {
        const product = (await pool.query('SELECT command, price FROM products WHERE id=$1', [it.product_id])).rows[0];
        
        // Create one order record for each quantity
        const quantity = parseInt(it.quantity) || 1;
        for (let i = 0; i < quantity; i++) {
          // Create order with Stripe payment method
          const r = await pool.query(
            'INSERT INTO orders(order_group_id, user_id, playerid, discord_id, product_id, status, payment_method, paypal_order_id, created_at, approved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),now()) RETURNING *',
            [orderGroupId, uid, playerid, discordId || null, it.product_id, 'approved', 'stripe', paymentIntentId]
          );
          
          const order = r.rows[0];
          created.push(order);
          
          // Execute RCON command automatically
          if (product && product.command) {
            const cmd = product.command.replace(/\{playerid\}/g, playerid);
            try {
              const resp = await runRconCommand(cmd);
              await pool.query('UPDATE orders SET rcon_result=$1 WHERE id=$2', [resp ? String(resp) : null, order.id]);
            } catch (e) {
              console.error('RCON execution error for order', order.id, e);
              // Continue even if RCON fails
            }
          }
        }
      }
      
      // Clear cart
      await pool.query('DELETE FROM cart_items WHERE user_id=$1', [uid]);
      
      res.json({ success: true, orders: created, id: created[0] ? created[0].id : null, orderGroupId });
    } catch (e) {
      console.error('Order creation failed', e);
      res.status(500).json({ error: 'Order creation failed' });
    }
  } catch (e) {
    console.error('Stripe confirm error:', e);
    res.status(500).json({ error: 'Failed to confirm Stripe payment' });
  }
});

// Create ECPay payment (ATM or CVS)
app.post('/ecpay/create-payment', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const playerid = req.user.playerid;
  const { discordId, paymentType, currency: userCurrency } = req.body; // paymentType: 'ATM' or 'CVS'
  
  console.log('[ECPay] Create payment request:', { uid, playerid, paymentType, userCurrency });
  
  const config = getECPayConfig();
  if (!config) {
    console.error('[ECPay] Config not found');
    return res.status(500).json({ error: 'ECPay not configured' });
  }
  
  const cart = (await pool.query('SELECT c.*, p.name, p.price FROM cart_items c LEFT JOIN products p ON c.product_id = p.id WHERE c.user_id=$1', [uid])).rows;
  if (!cart || cart.length === 0) {
    console.error('[ECPay] Empty cart for user:', uid);
    return res.status(400).json({ error: 'Empty cart' });
  }
  
  console.log('[ECPay] Cart items:', cart.length);
  
  const currencyConfig = getCurrencyConfig();
  const selectedCurrency = userCurrency || currencyConfig.currency;
  
  // Calculate total from cart (prices stored in TWD)
  let totalTWD = 0;
  for (const item of cart) {
    if (item.price) totalTWD += parseFloat(item.price) * item.quantity;
  }
  
  // Convert to selected currency for payment
  const amountInCurrency = convertPrice(totalTWD, selectedCurrency);
  const totalAmount = Math.round(amountInCurrency);
  
  // ECPay only supports TWD
  if (selectedCurrency !== 'TWD') {
    console.error('[ECPay] Unsupported currency:', selectedCurrency);
    return res.status(400).json({ 
      error: 'ECPay 僅支援新台幣（TWD）付款，請切換貨幣後再試' 
    });
  }
  
  console.log('[ECPay] Total amount:', totalAmount, 'TWD');
  
  // Generate unique order group ID
  const orderGroupId = crypto.randomUUID();
  const merchantTradeNo = `MC${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  try {
    // Create pending orders in database
    const created = [];
    for (const it of cart) {
      const quantity = parseInt(it.quantity) || 1;
      for (let i = 0; i < quantity; i++) {
        const r = await pool.query(
          'INSERT INTO orders(order_group_id, user_id, playerid, discord_id, product_id, status, payment_method, paypal_order_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING *',
          [orderGroupId, uid, playerid, discordId || null, it.product_id, 'pending', paymentType === 'ATM' ? 'ecpay_atm' : 'ecpay_cvs', merchantTradeNo]
        );
        created.push(r.rows[0]);
      }
    }
    
    // Clear cart
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [uid]);
    
    // Prepare ECPay payment form data
    const baseUrl = config.test_mode 
      ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
      : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
    
    const tradeDesc = `Minecraft商城訂單 #${orderGroupId.substring(0, 8)}`;
    const itemName = cart.map(it => it.name || 'Product').join('#');
    
    // Format date as YYYY/MM/DD HH:mm:ss for ECPay
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const merchantTradeDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    
    const params = {
      MerchantID: config.merchant_id,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: merchantTradeDate,
      PaymentType: 'aio',
      TotalAmount: totalAmount,
      TradeDesc: tradeDesc,
      ItemName: itemName.substring(0, 200),
      ReturnURL: config.order_result_url,
      ChoosePayment: paymentType === 'ATM' ? 'ATM' : 'CVS',
      ClientBackURL: config.return_url,
      NeedExtraPaidInfo: 'Y',
      EncryptType: 1
    };
    
    // Add payment type specific params
    if (paymentType === 'ATM') {
      params.ExpireDate = 3; // 3 days to pay
    } else if (paymentType === 'CVS') {
      params.StoreExpireDate = 10080; // 7 days in minutes
      params.Desc_1 = `訂單編號: ${orderGroupId.substring(0, 8)}`;
      params.Desc_2 = `玩家: ${playerid}`;
      params.Desc_3 = `總金額: NT$${totalAmount}`;
    }
    
    // Generate CheckMacValue
    const checkMacValue = generateECPayCheckMac(params, config.hash_key, config.hash_iv);
    params.CheckMacValue = checkMacValue;
    
    console.log('[ECPay] Creating payment:', {
      merchantTradeNo,
      paymentType,
      totalAmount,
      orderGroupId: orderGroupId.substring(0, 8)
    });
    
    // In test mode, automatically approve orders after a delay (simulating payment)
    if (config.test_mode) {
      console.log('[ECPay] Test mode: Will auto-approve orders after 10 seconds');
      setTimeout(async () => {
        try {
          const ordersToApprove = await pool.query(
            'SELECT * FROM orders WHERE paypal_order_id=$1',
            [merchantTradeNo]
          );
          
          if (ordersToApprove.rows.length > 0) {
            console.log(`[ECPay] Auto-approving ${ordersToApprove.rows.length} orders for ${merchantTradeNo}`);
            
            for (const order of ordersToApprove.rows) {
              await pool.query(
                'UPDATE orders SET status=$1, approved_at=now() WHERE id=$2',
                ['approved', order.id]
              );
              
              // Execute RCON command
              const product = (await pool.query('SELECT command FROM products WHERE id=$1', [order.product_id])).rows[0];
              if (product && product.command) {
                const cmd = product.command.replace(/\{playerid\}/g, order.playerid);
                try {
                  const resp = await runRconCommand(cmd);
                  await pool.query('UPDATE orders SET rcon_result=$1 WHERE id=$2', [resp ? String(resp) : null, order.id]);
                  console.log(`[ECPay] RCON executed for order ${order.id}`);
                } catch (e) {
                  console.error('[ECPay] RCON execution error for order', order.id, e);
                }
              }
            }
            console.log('[ECPay] Auto-approval completed');
          }
        } catch (e) {
          console.error('[ECPay] Auto-approval error:', e);
        }
      }, 10000); // 10 seconds delay
    }
    
    res.json({
      success: true,
      orderGroupId,
      merchantTradeNo,
      formData: params,
      actionUrl: baseUrl,
      testMode: config.test_mode
    });
    
  } catch (e) {
    console.error('ECPay order creation failed:', e);
    res.status(500).json({ error: 'Failed to create ECPay payment', details: e.message });
  }
});

// ECPay payment result callback
app.post('/ecpay/order-result', express.urlencoded({ extended: true }), async (req, res) => {
  console.log('ECPay payment result:', req.body);
  
  const config = getECPayConfig();
  if (!config) {
    return res.status(500).send('0|ECPay not configured');
  }
  
  try {
    const { CheckMacValue, ...params } = req.body;
    
    // Verify CheckMacValue
    const calculatedMac = generateECPayCheckMac(params, config.hash_key, config.hash_iv);
    if (calculatedMac !== CheckMacValue) {
      console.error('ECPay CheckMacValue verification failed');
      return res.status(400).send('0|CheckMacValue verification failed');
    }
    
    const { MerchantTradeNo, RtnCode, PaymentType, BankCode, vAccount, ExpireDate, PaymentNo } = params;
    
    // Find orders by merchant trade number
    const orders = await pool.query(
      'SELECT * FROM orders WHERE paypal_order_id=$1',
      [MerchantTradeNo]
    );
    
    if (orders.rows.length === 0) {
      console.error('ECPay order not found:', MerchantTradeNo);
      return res.status(404).send('0|Order not found');
    }
    
    // Store payment info
    const paymentInfo = {
      bank_code: BankCode,
      v_account: vAccount,
      expire_date: ExpireDate,
      payment_no: PaymentNo,
      payment_type: PaymentType
    };
    
    // Update orders with payment info (store in proof_path as JSON for now)
    await pool.query(
      'UPDATE orders SET proof_path=$1 WHERE paypal_order_id=$2',
      [JSON.stringify(paymentInfo), MerchantTradeNo]
    );
    
    // If payment succeeded (RtnCode = 1 for ATM/CVS when payment is completed)
    if (RtnCode === '1' || RtnCode === 1) {
      // Auto-approve orders and execute RCON
      for (const order of orders.rows) {
        await pool.query(
          'UPDATE orders SET status=$1, approved_at=now() WHERE id=$2',
          ['approved', order.id]
        );
        
        // Execute RCON command
        const product = (await pool.query('SELECT command FROM products WHERE id=$1', [order.product_id])).rows[0];
        if (product && product.command) {
          const cmd = product.command.replace(/\{playerid\}/g, order.playerid);
          try {
            const resp = await runRconCommand(cmd);
            await pool.query('UPDATE orders SET rcon_result=$1 WHERE id=$2', [resp ? String(resp) : null, order.id]);
          } catch (e) {
            console.error('RCON execution error for order', order.id, e);
          }
        }
      }
    }
    
    res.send('1|OK');
  } catch (e) {
    console.error('ECPay callback error:', e);
    res.status(500).send('0|Server error');
  }
});

// ECPay payment info callback (for ATM/CVS code generation)
app.post('/ecpay/payment-info', express.urlencoded({ extended: true }), async (req, res) => {
  console.log('ECPay payment info:', req.body);
  
  const config = getECPayConfig();
  if (!config) {
    return res.status(500).send('0|ECPay not configured');
  }
  
  try {
    const { CheckMacValue, ...params } = req.body;
    
    // Verify CheckMacValue
    const calculatedMac = generateECPayCheckMac(params, config.hash_key, config.hash_iv);
    if (calculatedMac !== CheckMacValue) {
      console.error('ECPay CheckMacValue verification failed');
      return res.status(400).send('0|CheckMacValue verification failed');
    }
    
    const { MerchantTradeNo, PaymentType, BankCode, vAccount, ExpireDate, PaymentNo } = params;
    
    // Store payment info in database
    const paymentInfo = {
      bank_code: BankCode,
      v_account: vAccount,
      expire_date: ExpireDate,
      payment_no: PaymentNo,
      payment_type: PaymentType
    };
    
    await pool.query(
      'UPDATE orders SET proof_path=$1 WHERE paypal_order_id=$2',
      [JSON.stringify(paymentInfo), MerchantTradeNo]
    );
    
    console.log(`ECPay payment info stored for ${MerchantTradeNo}:`, paymentInfo);
    
    res.send('1|OK');
  } catch (e) {
    console.error('ECPay payment info callback error:', e);
    res.status(500).send('0|Server error');
  }
});

// 玩家JWT驗證中介層
const bcrypt = require('bcryptjs');
const PLAYER_JWT_SECRET = process.env.PLAYER_JWT_SECRET || 'playersecret';
function playerAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: '缺少token' });
  const parts = h.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'token格式錯誤' });
  try {
    const payload = jwt.verify(parts[1], PLAYER_JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'token無效' });
  }
}

// 玩家註冊
app.post('/auth/register', async (req, res) => {
  const { playerid, password } = req.body;
  if (!playerid || !password) return res.status(400).json({ error: '缺少欄位' });
  const exists = await pool.query('SELECT id FROM users WHERE playerid=$1', [playerid]);
  if (exists.rows.length > 0) return res.status(400).json({ error: '玩家ID已註冊' });
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query('INSERT INTO users(playerid, password_hash) VALUES($1,$2) RETURNING id, playerid', [playerid, hash]);
  const token = jwt.sign({ uid: result.rows[0].id, playerid }, PLAYER_JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, playerid });
});

// 玩家登入
app.post('/auth/login', async (req, res) => {
  const { playerid, password } = req.body;
  if (!playerid || !password) return res.status(400).json({ error: '缺少欄位' });
  const user = (await pool.query('SELECT * FROM users WHERE playerid=$1', [playerid])).rows[0];
  if (!user) return res.status(400).json({ error: '帳號或密碼錯誤' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: '帳號或密碼錯誤' });
  const token = jwt.sign({ uid: user.id, playerid }, PLAYER_JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, playerid });
});

// Simple admin login (returns JWT)
app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid password' });
});

// Player change password (authenticated)
app.post('/auth/change-password', playerAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '缺少欄位' });
  if (newPassword.length < 6) return res.status(400).json({ error: '新密碼至少需要6個字符' });
  
  const uid = req.user.uid;
  const user = (await pool.query('SELECT * FROM users WHERE id=$1', [uid])).rows[0];
  if (!user) return res.status(404).json({ error: '用戶不存在' });
  
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(400).json({ error: '當前密碼錯誤' });
  
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, uid]);
  res.json({ success: true, message: '密碼已更新' });
});

// Admin: get all users
app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, playerid, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) {
    console.error('Error fetching users:', e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: reset user password (generates random password)
app.post('/admin/users/:id/reset-password', adminAuth, async (req, res) => {
  const userId = req.params.id;
  
  try {
    const user = (await pool.query('SELECT * FROM users WHERE id=$1', [userId])).rows[0];
    if (!user) return res.status(404).json({ error: '用戶不存在' });
    
    // Generate random password (8 characters: letters and numbers)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let newPassword = '';
    for (let i = 0; i < 8; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userId]);
    
    res.json({ 
      success: true, 
      newPassword,
      playerid: user.playerid,
      message: '密碼已重置，請將新密碼通過 Discord 發送給用戶' 
    });
  } catch (e) {
    console.error('Error resetting password:', e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Admin: delete user
app.delete('/admin/users/:id', adminAuth, async (req, res) => {
  const userId = req.params.id;
  
  try {
    // Check if user has orders
    const orders = await pool.query('SELECT COUNT(*) as count FROM orders WHERE user_id=$1', [userId]);
    const hasOrders = parseInt(orders.rows[0].count) > 0;
    
    if (hasOrders) {
      return res.status(400).json({ 
        error: '無法刪除：該用戶有訂單記錄',
        suggestion: '建議重置密碼而不是刪除帳號'
      });
    }
    
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [userId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    
    res.json({ success: true, message: '用戶已刪除' });
  } catch (e) {
    console.error('Error deleting user:', e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

function adminAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Missing token' });
  const parts = h.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Bad token' });
  try {
    const payload = jwt.verify(parts[1], ADMIN_JWT_SECRET);
    if (payload.role === 'admin') return next();
    return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Product CRUD
app.post('/products', adminAuth, upload.single('image'), async (req, res) => {
  const { name, price, command, active, stock, description } = req.body;
  const image = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  // If `active` not provided by form, default to true
  const isActive = typeof active === 'undefined' ? true : active === 'true';
  const stockNum = parseInt(stock, 10) || 0;
  const result = await pool.query(
    'INSERT INTO products(name, price, command, image, active, stock, description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [name, price || 0, command || '', image, isActive, stockNum, description || '']
  );
  res.json(result.rows[0]);
});

app.get('/products', async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE active = true ORDER BY id');
  res.json(result.rows);
});

app.get('/admin/products', adminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(result.rows);
});

app.get('/products/:id', async (req, res) => {
  const id = req.params.id;
  const result = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

app.put('/products/:id', adminAuth, upload.single('image'), async (req, res) => {
  const id = req.params.id;
  const { name, price, command, active, stock, description } = req.body;
  console.log('PUT /products/:id - Received:', { id, body: req.body, hasFile: !!req.file, fileName: req.file?.originalname });
  let image = null;
  if (req.file) image = `/uploads/${path.basename(req.file.path)}`;
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  if (name !== undefined) { updates.push(`name=$${paramCount++}`); values.push(name); }
  if (price !== undefined) { updates.push(`price=$${paramCount++}`); values.push(price || 0); }
  if (command !== undefined) { updates.push(`command=$${paramCount++}`); values.push(command || ''); }
  if (image) { updates.push(`image=$${paramCount++}`); values.push(image); }
  if (active !== undefined) { 
    const isActive = active === 'true' || active === true;
    updates.push(`active=$${paramCount++}`); 
    values.push(isActive); 
  }
  if (stock !== undefined) { updates.push(`stock=$${paramCount++}`); values.push(parseInt(stock, 10) || 0); }
  if (description !== undefined) { updates.push(`description=$${paramCount++}`); values.push(description || ''); }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  const query = `UPDATE products SET ${updates.join(', ')} WHERE id=$${paramCount} RETURNING *`;
  
  try {
    console.log('Executing query:', query);
    console.log('With values:', values);
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log('Updated product:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (e) {
    console.error('Error updating product:', e);
    res.status(500).json({ error: 'Failed to update product', detail: e.message });
  }
});

app.delete('/products/:id', adminAuth, async (req, res) => {
  const id = req.params.id;
  try {
    // Check if any orders reference this product
    const ord = await pool.query('SELECT COUNT(*) AS cnt FROM orders WHERE product_id=$1', [id]);
    const cnt = parseInt(ord.rows[0].cnt, 10);
    if (cnt > 0) {
      // If there are orders, do not hard delete. Mark as inactive instead.
      const result = await pool.query('UPDATE products SET active=false WHERE id=$1 RETURNING *', [id]);
      return res.status(200).json({ success: true, note: 'product has existing orders; it was deactivated instead', product: result.rows[0] });
    }
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting product:', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to delete product', detail: e.message });
  }
});

// Orders
// legacy single-order create (keeps compatibility)
app.post('/orders', upload.single('proof'), async (req, res) => {
  const { playerid, product_id } = req.body;
  if (!playerid || !product_id) return res.status(400).json({ error: 'Missing fields' });
  const proof = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const result = await pool.query(
    'INSERT INTO orders(playerid, product_id, proof_path, status, created_at) VALUES($1,$2,$3,$4,now()) RETURNING *',
    [playerid, product_id, proof, 'pending']
  );
  res.json(result.rows[0]);
});

// Checkout route used by frontend: requires authenticated player, uses their cart
app.post('/orders/checkout', playerAuth, async (req, res) => {
  const { discordId, proof, paymentMethod } = req.body || {};
  const uid = req.user.uid;
  const playerid = req.user.playerid;
  const cart = (await pool.query('SELECT * FROM cart_items WHERE user_id=$1', [uid])).rows;
  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Empty cart' });
  
  // If paymentMethod is 'paypal', reject - they should use the PayPal capture endpoint instead
  if (paymentMethod === 'paypal') {
    return res.status(400).json({ error: 'Use PayPal capture endpoint for PayPal payments' });
  }
  
  // Generate unique order group ID for this checkout session
  const orderGroupId = crypto.randomUUID();
  
  const created = [];
  try {
    for (const it of cart) {
      // Create one order record for each quantity
      const quantity = parseInt(it.quantity) || 1;
      for (let i = 0; i < quantity; i++) {
        const r = await pool.query(
          'INSERT INTO orders(order_group_id, user_id, playerid, discord_id, product_id, proof_path, status, payment_method, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING *',
          [orderGroupId, uid, playerid, discordId || null, it.product_id, proof || null, 'pending', paymentMethod || 'manual']
        );
        created.push(r.rows[0]);
      }
    }
    // clear cart for user
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [uid]);
    res.json({ success: true, orders: created, id: created[0] ? created[0].id : null, orderGroupId });
  } catch (e) {
    console.error('Checkout failed', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Player upload payment proof for an order group they own
app.post('/orders/:groupId/upload_proof', playerAuth, upload.single('file'), async (req, res) => {
  const groupId = req.params.groupId;
  const uid = req.user.uid;
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${path.basename(req.file.path)}`;
  // ensure order group belongs to user
  const ord = (await pool.query('SELECT * FROM orders WHERE order_group_id=$1 AND user_id=$2 LIMIT 1', [groupId, uid])).rows[0];
  if (!ord) return res.status(404).json({ error: 'Order not found' });
  // Update all orders in the group
  await pool.query('UPDATE orders SET proof_path=$1 WHERE order_group_id=$2', [url, groupId]);
  res.json({ url });
});

// Player: get own orders
app.get('/orders', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  // Get order groups with summary info (similar to admin view)
  const result = await pool.query(`
    SELECT 
      o.order_group_id,
      MAX(o.playerid) as playerid,
      MAX(o.discord_id) as discord_id,
      MAX(o.proof_path) as proof_path,
      MAX(o.payment_method) as payment_method,
      MAX(o.paypal_order_id) as paypal_order_id,
      MIN(o.created_at) as created_at,
      SUM(p.price) as total_amount,
      COUNT(o.id) as item_count,
      STRING_AGG(DISTINCT o.status, ',') as statuses
    FROM orders o 
    LEFT JOIN products p ON p.id = o.product_id 
    WHERE o.user_id=$1 AND o.order_group_id IS NOT NULL
    GROUP BY o.order_group_id
    ORDER BY MIN(o.created_at) DESC
  `, [uid]);
  
  const rows = result.rows.map(o => ({
    orderGroupId: o.order_group_id,
    playerid: o.playerid,
    discordId: o.discord_id,
    proofUrl: o.proof_path,
    paymentMethod: o.payment_method,
    paypalOrderId: o.paypal_order_id,
    createdAt: o.created_at,
    totalAmount: parseFloat(o.total_amount || 0),
    itemCount: parseInt(o.item_count || 0),
    statuses: o.statuses
  }));
  res.json(rows);
});

// Player: get single order if owned
app.get('/orders/:id', playerAuth, async (req, res) => {
  const groupId = req.params.id;
  const uid = req.user.uid;
  
  // Get order group summary
  const summaryResult = await pool.query(`
    SELECT 
      o.order_group_id,
      MAX(o.playerid) as playerid,
      MAX(o.discord_id) as discord_id,
      MAX(o.proof_path) as proof_path,
      MAX(o.payment_method) as payment_method,
      MAX(o.paypal_order_id) as paypal_order_id,
      MIN(o.created_at) as created_at,
      SUM(p.price) as total_amount
    FROM orders o 
    LEFT JOIN products p ON p.id = o.product_id 
    WHERE o.order_group_id=$1 AND o.user_id=$2
    GROUP BY o.order_group_id
  `, [groupId, uid]);
  
  if (summaryResult.rows.length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // Get order items
  const itemsResult = await pool.query(`
    SELECT 
      o.id,
      o.product_id,
      o.status,
      o.approved_at,
      o.rcon_result,
      o.created_at,
      p.name as product_name,
      p.price,
      p.command
    FROM orders o 
    LEFT JOIN products p ON p.id = o.product_id 
    WHERE o.order_group_id=$1 AND o.user_id=$2
    ORDER BY o.created_at ASC
  `, [groupId, uid]);
  
  const summary = summaryResult.rows[0];
  const items = itemsResult.rows.map(item => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    price: parseFloat(item.price || 0),
    command: item.command,
    status: item.status,
    approvedAt: item.approved_at,
    rconResult: item.rcon_result,
    createdAt: item.created_at
  }));
  
  res.json({
    orderGroupId: summary.order_group_id,
    playerid: summary.playerid,
    discordId: summary.discord_id,
    proofUrl: summary.proof_path,
    paymentMethod: summary.payment_method,
    paypalOrderId: summary.paypal_order_id,
    createdAt: summary.created_at,
    totalAmount: parseFloat(summary.total_amount || 0),
    items: items
  });
});

// Admin: list all orders
app.get('/admin/orders', adminAuth, async (req, res) => {
  // Get unique order groups with summary info
  const result = await pool.query(`
    SELECT 
      o.order_group_id,
      MAX(o.playerid) as playerid,
      MAX(o.discord_id) as discord_id,
      MAX(o.proof_path) as proof_path,
      MAX(o.payment_method) as payment_method,
      MAX(o.paypal_order_id) as paypal_order_id,
      MIN(o.created_at) as created_at,
      SUM(p.price) as total_amount,
      COUNT(o.id) as item_count,
      STRING_AGG(DISTINCT o.status, ',') as statuses
    FROM orders o 
    LEFT JOIN products p ON p.id = o.product_id 
    WHERE o.order_group_id IS NOT NULL
    GROUP BY o.order_group_id
    ORDER BY MIN(o.created_at) DESC
  `);
  
  const rows = result.rows.map(o => ({
    orderGroupId: o.order_group_id,
    playerid: o.playerid,
    discordId: o.discord_id,
    proofUrl: o.proof_path,
    paymentMethod: o.payment_method,
    paypalOrderId: o.paypal_order_id,
    createdAt: o.created_at,
    totalAmount: parseFloat(o.total_amount || 0),
    itemCount: parseInt(o.item_count || 0),
    statuses: o.statuses
  }));
  res.json(rows);
});

// Admin: get order group detail
app.get('/admin/orders/:groupId', adminAuth, async (req, res) => {
  const groupId = req.params.groupId;
  
  // Get order group summary
  const summaryResult = await pool.query(`
    SELECT 
      o.order_group_id,
      MAX(o.playerid) as playerid,
      MAX(o.discord_id) as discord_id,
      MAX(o.proof_path) as proof_path,
      MAX(o.payment_method) as payment_method,
      MAX(o.paypal_order_id) as paypal_order_id,
      MIN(o.created_at) as created_at,
      SUM(p.price) as total_amount
    FROM orders o 
    LEFT JOIN products p ON p.id = o.product_id 
    WHERE o.order_group_id = $1
    GROUP BY o.order_group_id
  `, [groupId]);
  
  if (summaryResult.rows.length === 0) return res.status(404).json({ error: 'Order group not found' });
  
  // Get all items in this order group
  const itemsResult = await pool.query(`
    SELECT o.*, p.name AS product_name, p.price, p.command, p.image 
    FROM orders o 
    LEFT JOIN products p ON p.id = o.product_id 
    WHERE o.order_group_id = $1
    ORDER BY o.id
  `, [groupId]);
  
  const summary = summaryResult.rows[0];
  res.json({
    orderGroupId: summary.order_group_id,
    playerid: summary.playerid,
    discordId: summary.discord_id,
    proofUrl: summary.proof_path,
    paymentMethod: summary.payment_method,
    paypalOrderId: summary.paypal_order_id,
    createdAt: summary.created_at,
    totalAmount: parseFloat(summary.total_amount || 0),
    items: itemsResult.rows.map(o => ({
      id: o.id,
      productId: o.product_id,
      productName: o.product_name,
      productPrice: parseFloat(o.price || 0),
      productImage: o.image,
      command: o.command,
      status: o.status,
      approvedAt: o.approved_at,
      rconResult: o.rcon_result
    }))
  });
});

// Upload proof for an order group// Cart endpoints
// Cart endpoints scoped to authenticated player
app.get('/cart', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const result = await pool.query('SELECT ci.*, p.id as product_id, p.name, p.price, p.image FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id WHERE ci.user_id=$1', [uid]);
  const data = result.rows.map(r => ({ id: r.id, productId: r.product_id, quantity: r.quantity, product: { id: r.product_id, name: r.name, price: Number(r.price), image: r.image } }));
  res.json(data);
});

app.post('/cart', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const { productId, quantity } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'Missing productId' });
  const q = Number(quantity) || 1;
  const r = await pool.query('INSERT INTO cart_items(user_id, product_id, quantity) VALUES($1,$2,$3) RETURNING *', [uid, productId, q]);
  res.json(r.rows[0]);
});

app.put('/cart/:id', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const id = req.params.id;
  const { quantity } = req.body || {};
  const q = Number(quantity) || 1;
  const r = await pool.query('UPDATE cart_items SET quantity=$1 WHERE id=$2 AND user_id=$3 RETURNING *', [q, id, uid]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

app.delete('/cart/:id', playerAuth, async (req, res) => {
  const uid = req.user.uid;
  const id = req.params.id;
  await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [id, uid]);
  res.json({ success: true });
});

// Generic upload endpoint used by frontend
app.post('/uploads/payment-proof', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${path.basename(req.file.path)}`;
  res.json({ url });
});

async function runRconCommand(cmd) {
  const host = process.env.RCON_HOST;
  const port = parseInt(process.env.RCON_PORT || '25575', 10);
  const pass = process.env.RCON_PASSWORD;
  if (!host || !port || !pass) throw new Error('RCON not configured');
  const rcon = new Rcon({ host, port, password: pass });
  try {
    await rcon.connect();
    const resp = await rcon.send(cmd);
    await rcon.end();
    return resp;
  } catch (e) {
    console.error('RCON execution error:', e && e.stack ? e.stack : e);
    try { await rcon.end(); } catch (e2) { console.error('Error closing rcon:', e2); }
    throw e;
  }
}

app.post('/orders/:id/approve', adminAuth, async (req, res) => {
  const id = req.params.id;
  const order = (await pool.query('SELECT o.*, p.command FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id=$1', [id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'approved') return res.status(400).json({ error: 'Already approved' });
  const cmdTemplate = order.command || '';
  const playerid = order.playerid;
  // Replace {playerid} safely
  const cmd = cmdTemplate.replace(/\{playerid\}/g, playerid);
  try {
    const resp = await runRconCommand(cmd);
    await pool.query('UPDATE orders SET status=$1, approved_at=now(), rcon_result=$2 WHERE id=$3', ['approved', resp ? String(resp) : null, id]);
    return res.json({ success: true, resp });
  } catch (e) {
    console.error('Approve failed:', e && e.stack ? e.stack : e);
    return res.status(500).json({ error: 'Failed to run command', detail: e.message });
  }
});

// Alias for admin approve route used by frontend
app.post('/admin/orders/:id/approve', adminAuth, async (req, res) => {
  const id = req.params.id;
  const order = (await pool.query('SELECT o.*, p.command FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id=$1', [id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'approved') return res.status(400).json({ error: 'Already approved' });
  const cmdTemplate = order.command || '';
  const playerid = order.playerid;
  const cmd = cmdTemplate.replace(/\{playerid\}/g, playerid);
  try {
    const resp = await runRconCommand(cmd);
    await pool.query('UPDATE orders SET status=$1, approved_at=now(), rcon_result=$2 WHERE id=$3', ['approved', resp ? String(resp) : null, id]);
    return res.json({ success: true, resp });
  } catch (e) {
    console.error('Approve failed:', e && e.stack ? e.stack : e);
    return res.status(500).json({ error: 'Failed to run command', detail: e.message });
  }
});

app.post('/admin/orders/:id/reject', adminAuth, async (req, res) => {
  const id = req.params.id;
  const order = (await pool.query('SELECT * FROM orders WHERE id=$1', [id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'rejected') return res.status(400).json({ error: 'Already rejected' });
  await pool.query('UPDATE orders SET status=$1 WHERE id=$2', ['rejected', id]);
  res.json({ success: true });
});

// Alias routes for items (same as orders)
app.post('/admin/orders/items/:id/approve', adminAuth, async (req, res) => {
  const id = req.params.id;
  const order = (await pool.query('SELECT o.*, p.command FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id=$1', [id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'approved') return res.status(400).json({ error: 'Already approved' });
  const cmdTemplate = order.command || '';
  const playerid = order.playerid;
  const cmd = cmdTemplate.replace(/\{playerid\}/g, playerid);
  try {
    const resp = await runRconCommand(cmd);
    await pool.query('UPDATE orders SET status=$1, approved_at=now(), rcon_result=$2 WHERE id=$3', ['approved', resp ? String(resp) : null, id]);
    return res.json({ success: true, resp });
  } catch (e) {
    console.error('Approve failed:', e && e.stack ? e.stack : e);
    return res.status(500).json({ error: 'Failed to run command', detail: e.message });
  }
});

app.post('/admin/orders/items/:id/reject', adminAuth, async (req, res) => {
  const id = req.params.id;
  const order = (await pool.query('SELECT * FROM orders WHERE id=$1', [id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'rejected') return res.status(400).json({ error: 'Already rejected' });
  await pool.query('UPDATE orders SET status=$1 WHERE id=$2', ['rejected', id]);
  res.json({ success: true });
});

// simple health
app.get('/health', (req, res) => res.json({ ok: true }));

// Initialize DB if tables missing
async function waitForDb(retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`Waiting for DB... attempt ${i + 1}/${retries}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unable to connect to DB');
}

(async function init() {
  try {
    await waitForDb(15, 2000);
    const sql = fs.readFileSync(path.join(__dirname, 'init.sql')).toString();
    await pool.query(sql);

    // POC mode configuration
    const pocConfigPath = process.env.POC_CONFIG_PATH || path.join(__dirname, 'poc-config.json');
    const pocMode = (process.env.POC_MODE || '').toString().toLowerCase() === 'true';

    let pocConfig = null;
    if (fs.existsSync(pocConfigPath)) {
      try { pocConfig = JSON.parse(fs.readFileSync(pocConfigPath, 'utf8')); } catch (e) { console.error('Failed to parse poc-config.json', e); pocConfig = null; }
    }

    async function copyPocImages() {
      if (!pocConfig) return;
      try {
        const srcDir = path.join(__dirname, 'poc_res');
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(srcDir)) return;
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        if (pocConfig.clear_uploads_before_copy) {
          const files = fs.readdirSync(uploadsDir).filter(f => f !== '.' && f !== '..');
          for (const f of files) {
            try { fs.unlinkSync(path.join(uploadsDir, f)); } catch (e) {}
          }
        }

        for (const fn of fs.readdirSync(srcDir)) {
          const ext = path.extname(fn).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
            const src = path.join(srcDir, fn);
            const dest = path.join(uploadsDir, fn);
            try { fs.copyFileSync(src, dest); } catch (e) { console.error('copy image error', e); }
          }
        }
      } catch (e) {
        console.error('Error copying poc images:', e);
      }
    }

    async function resetDbToPoc() {
      if (!pocConfig) {
        console.log('POC config not found; skipping reset');
        return;
      }

      console.log('Resetting DB to POC state...');
      try {
        if (pocConfig.copy_images_to_uploads) await copyPocImages();

        await pool.query('BEGIN');

        await pool.query('DELETE FROM orders');
        await pool.query('DELETE FROM cart_items');
        await pool.query('DELETE FROM products');
        await pool.query('DELETE FROM users');

        const userIdMap = {};
        const users = pocConfig.default_users || [];
        for (const u of users) {
          if (!u || !u.playerid) continue;
          const pwd = u.password || 'pocpass';
          const hashed = await bcrypt.hash(pwd, 10);
          const r = await pool.query('INSERT INTO users(playerid, password_hash, created_at) VALUES($1,$2,now()) RETURNING id', [u.playerid, hashed]);
          userIdMap[u.playerid] = r.rows[0].id;
        }

        const productIdList = [];
        const products = pocConfig.default_products || [];
        for (const p of products) {
          const imagePath = p.image && p.image.startsWith('/uploads/') ? p.image : (p.image ? `/uploads/${path.basename(p.image)}` : null);
          const r = await pool.query('INSERT INTO products(name, price, command, image, active, stock, description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [p.name, p.price||0, p.command||'', imagePath, p.active===undefined?true:p.active, p.stock||0, p.description||'']);
          productIdList.push(r.rows[0].id);
        }

        const examples = pocConfig.example_orders || [];
        for (let i = 0; i < examples.length; i++) {
          const ex = examples[i];
          const playerid = ex.playerid || (users[0] && users[0].playerid) || 'poc_user';
          const user_id = userIdMap[playerid] || null;
          const product_id = productIdList.length ? productIdList[i % productIdList.length] : null;
          const status = ex.status || 'pending';
          const payment_method = ex.payment_method || 'manual';
          const paypal_order_id = ex.paypal_order_id || null;
          const order_group_id = `POC${Date.now()}${i}`;
          const approved_at = status === 'approved' ? new Date() : null;
          await pool.query('INSERT INTO orders(order_group_id, user_id, playerid, discord_id, product_id, proof_path, status, payment_method, paypal_order_id, created_at, approved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10)', [order_group_id, user_id, playerid, ex.discord_id || 'poc_discord', product_id, null, status, payment_method, paypal_order_id, approved_at]);
        }

        await pool.query('COMMIT');
        console.log('POC DB reset completed');
      } catch (e) {
        try { await pool.query('ROLLBACK'); } catch (er) { console.error('Rollback failed', er); }
        console.error('Failed to reset DB to POC state:', e && e.stack ? e.stack : e);
      }
    }

    // admin endpoint to manually trigger reset
    app.post('/admin/resetdb', adminAuth, async (req, res) => {
      try {
        await resetDbToPoc();
        return res.json({ success: true });
      } catch (e) {
        console.error('Manual reset failed:', e);
        return res.status(500).json({ error: 'reset failed' });
      }
    });

    if (pocMode && pocConfig && pocConfig.enabled) {
      console.log('POC mode enabled');
      await resetDbToPoc();
      // schedule check every minute, reset when minute === 0
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getMinutes() === 0) {
            console.log('Hourly POC reset triggered');
            await resetDbToPoc();
          }
        } catch (e) { console.error('Scheduled POC reset failed', e); }
      }, 60 * 1000);
    }

    app.listen(PORT, () => console.log('API running on', PORT));
  } catch (e) {
    console.error('Failed to initialize app:', e);
    process.exit(1);
  }
})();
