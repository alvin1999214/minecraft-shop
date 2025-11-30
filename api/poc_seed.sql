-- POC seed: clears key tables and inserts poc users, products and example orders
BEGIN;

-- delete existing data
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM products;
DELETE FROM users;

-- reset sequences (Postgres default sequence names)
SELECT setval(pg_get_serial_sequence('users','id'), 1, false);
SELECT setval(pg_get_serial_sequence('products','id'), 1, false);
SELECT setval(pg_get_serial_sequence('orders','id'), 1, false);
SELECT setval(pg_get_serial_sequence('cart_items','id'), 1, false);

-- insert default user
-- insert products (command fields contain the /give commands)
INSERT INTO products(name, price, command, image, active, stock, description)
VALUES
('POC Diamond Sword (Sharpness X)', 0, '/give {playerid} diamond_sword{Enchantments:[{id:"minecraft:sharpness",lvl:10}]} 1', '/uploads/poc_diamond_sword.png', true, 999, 'Sharpness X diamond sword for POC'),
('POC Diamond (x10)', 0, '/give {playerid} diamond 10', '/uploads/poc_diamond.png', true, 999, 'Bundle of diamonds for POC'),
('POC Dirt (x64)', 0, '/give {playerid} dirt 64', '/uploads/poc_dirt.png', true, 999, 'Dirt for testing');

-- create example orders for different payment methods and statuses
-- get ids
WITH u AS (SELECT id AS user_id, playerid FROM users WHERE playerid='poc_user'),
     p AS (SELECT id AS product_id FROM products ORDER BY id)
INSERT INTO orders(order_group_id, user_id, playerid, discord_id, product_id, proof_path, status, payment_method, paypal_order_id, created_at)
SELECT
  ('POC' || floor(random()*100000)::text),
  u.user_id,
  u.playerid,
  'poc_discord',
  p.product_id,
  null,
  CASE WHEN row_number() OVER () = 1 THEN 'approved' WHEN row_number() OVER () = 2 THEN 'approved' WHEN row_number() OVER () = 3 THEN 'pending' WHEN row_number() OVER () = 4 THEN 'pending' ELSE 'rejected' END,
  CASE WHEN row_number() OVER () = 1 THEN 'paypal' WHEN row_number() OVER () = 2 THEN 'stripe' WHEN row_number() OVER () = 3 THEN 'ecpay_atm' WHEN row_number() OVER () = 4 THEN 'ecpay_cvs' ELSE 'manual' END,
  CASE WHEN row_number() OVER () = 1 THEN 'POC_PAYPAL_1' WHEN row_number() OVER () = 2 THEN 'POC_STRIPE_1' WHEN row_number() OVER () = 3 THEN 'POC_ECPAY_1' WHEN row_number() OVER () = 4 THEN 'POC_ECPAY_2' ELSE null END,
  now()
FROM u, p
LIMIT 5;

COMMIT;
