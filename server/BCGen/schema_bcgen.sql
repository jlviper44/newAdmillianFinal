-- BCGen Database Schema

-- Orders table for tracking BC Gen orders
CREATE TABLE IF NOT EXISTS orders (
  orderId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  country TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  totalPrice REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL,
  fulfilledAt TEXT,
  accountsData TEXT
);

-- Cache table for storing availability data
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);