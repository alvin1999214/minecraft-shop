
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
  const cart = (await pool.query('SELECT * FROM cart_items WHERE user_id=$1', [uid])).rows;
  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Empty cart' });
  
  // Calculate total from cart
  let total = 0;
  for (const item of cart) {
    const product = (await pool.query('SELECT price FROM products WHERE id=$1', [item.product_id])).rows[0];
    if (product) total += parseFloat(product.price) * item.quantity;
  }
  
  const client = getPayPalClient();
  if (!client) return res.status(500).json({ error: 'PayPal not configured' });
  
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: total.toFixed(2)
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
  const result = await pool.query('SELECT o.*, p.name AS product_name, p.command, p.price FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.user_id=$1 ORDER BY o.id DESC', [uid]);
  // 將欄位轉為 camelCase 並補齊 totalAmount
  const rows = result.rows.map(o => ({
    id: o.id,
    userId: o.user_id,
    playerid: o.playerid,
    discordId: o.discord_id,
    productId: o.product_id,
    productName: o.product_name,
    proofUrl: o.proof_path,
    status: o.status,
    createdAt: o.created_at,
    approvedAt: o.approved_at,
    rconResult: o.rcon_result,
    command: o.command,
    totalAmount: o.price
  }));
  res.json(rows);
});

// Player: get single order if owned
app.get('/orders/:id', playerAuth, async (req, res) => {
  const id = req.params.id;
  const uid = req.user.uid;
  const result = await pool.query('SELECT o.*, p.name AS product_name, p.price, p.command FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id=$1 AND o.user_id=$2', [id, uid]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const o = result.rows[0];
  res.json({
    id: o.id,
    userId: o.user_id,
    playerid: o.playerid,
    discordId: o.discord_id,
    productId: o.product_id,
    productName: o.product_name,
    proofUrl: o.proof_path,
    status: o.status,
    createdAt: o.created_at,
    approvedAt: o.approved_at,
    rconResult: o.rcon_result,
    command: o.command,
    totalAmount: o.price
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
    app.listen(PORT, () => console.log('API running on', PORT));
  } catch (e) {
    console.error('Failed to initialize app:', e);
    process.exit(1);
  }
})();
