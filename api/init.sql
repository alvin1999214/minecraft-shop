CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  playerid TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  command TEXT DEFAULT '',
  image TEXT,
  active BOOLEAN DEFAULT TRUE,
  stock INTEGER DEFAULT 0,
  description TEXT DEFAULT ''
);


CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  playerid TEXT NOT NULL,
  discord_id TEXT,
  product_id INTEGER REFERENCES products(id),
  proof_path TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'manual',
  paypal_order_id TEXT,
  created_at TIMESTAMP DEFAULT now(),
  approved_at TIMESTAMP,
  rcon_result TEXT
);

-- index for fast lookup of orders by user
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items(user_id);
