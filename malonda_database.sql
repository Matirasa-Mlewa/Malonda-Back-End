-- ============================================================
--  MALONDA MARKETPLACE — Complete PostgreSQL Database Dump
--  Ready to import: psql -U postgres -d malonda -f malonda_database.sql
-- ============================================================

-- Drop and recreate database (optional, comment out if DB already exists)
-- DROP DATABASE IF EXISTS malonda;
-- CREATE DATABASE malonda;

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Drop tables in reverse dependency order ──────────────────────────────────
DROP TABLE IF EXISTS delivery_tracking CASCADE;
DROP TABLE IF EXISTS wishlist_items CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS escrows CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ─── Drop ENUMs ───────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS "VerificationLevel" CASCADE;
DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "ProductStatus" CASCADE;
DROP TYPE IF EXISTS "OrderStatus" CASCADE;
DROP TYPE IF EXISTS "PaymentMethod" CASCADE;
DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
DROP TYPE IF EXISTS "EscrowStatus" CASCADE;
DROP TYPE IF EXISTS "ReportStatus" CASCADE;
DROP TYPE IF EXISTS "DeliveryMethod" CASCADE;
DROP TYPE IF EXISTS "NotificationType" CASCADE;

-- ─── ENUMS ────────────────────────────────────────────────────────────────────
CREATE TYPE "VerificationLevel" AS ENUM ('BASIC', 'VERIFIED', 'TRUSTED');
CREATE TYPE "UserRole"          AS ENUM ('BUYER', 'SELLER', 'ADMIN');
CREATE TYPE "ProductStatus"     AS ENUM ('ACTIVE', 'SOLD', 'SUSPENDED', 'DRAFT');
CREATE TYPE "OrderStatus"       AS ENUM ('PENDING','PAID','ESCROWED','DISPATCHED','DELIVERED','COMPLETED','DISPUTED','CANCELLED','REFUNDED');
CREATE TYPE "PaymentMethod"     AS ENUM ('AIRTEL_MONEY', 'TNM_MPAMBA', 'CASH_ON_DELIVERY');
CREATE TYPE "PaymentStatus"     AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE "EscrowStatus"      AS ENUM ('HELD', 'RELEASED', 'REFUNDED');
CREATE TYPE "ReportStatus"      AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "DeliveryMethod"    AS ENUM ('PICKUP', 'LOCAL_DELIVERY', 'NATIONWIDE');
CREATE TYPE "NotificationType"  AS ENUM (
  'ORDER_PLACED','PAYMENT_ESCROWED','ORDER_DISPATCHED','ORDER_DELIVERED',
  'ESCROW_RELEASED','REFUND_ISSUED','NEW_MESSAGE','NEW_REVIEW',
  'VERIFICATION_APPROVED','VERIFICATION_REJECTED','PROMO',
  'DISPUTE_OPENED','DISPUTE_RESOLVED'
);

-- ============================================================
--  TABLES
-- ============================================================

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               VARCHAR(20)   NOT NULL UNIQUE,
  name                VARCHAR(100)  NOT NULL,
  password_hash       TEXT          NOT NULL,
  role                "UserRole"    NOT NULL DEFAULT 'BUYER',
  location            VARCHAR(200),
  district            VARCHAR(100),
  verification_level  "VerificationLevel" NOT NULL DEFAULT 'BASIC',
  is_seller           BOOLEAN       NOT NULL DEFAULT FALSE,
  is_suspended        BOOLEAN       NOT NULL DEFAULT FALSE,
  trust_score         INTEGER       NOT NULL DEFAULT 0,
  avatar_url          TEXT,
  push_token          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── otp_codes ────────────────────────────────────────────────────────────────
CREATE TABLE otp_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  phone       VARCHAR(20) NOT NULL,
  code        VARCHAR(6)  NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── verifications ────────────────────────────────────────────────────────────
CREATE TABLE verifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  national_id_url  TEXT,
  national_id_back TEXT,
  selfie_url       TEXT,
  national_id_no   VARCHAR(50),
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  reviewed_by      UUID        REFERENCES users(id),
  review_note      TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);

-- ─── products ─────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(200)      NOT NULL,
  description      TEXT              NOT NULL,
  price            NUMERIC(12,2)     NOT NULL,
  quantity         INTEGER           NOT NULL DEFAULT 1,
  category         VARCHAR(100)      NOT NULL,
  location         VARCHAR(200)      NOT NULL,
  district         VARCHAR(100)      NOT NULL,
  status           "ProductStatus"   NOT NULL DEFAULT 'ACTIVE',
  escrow_enabled   BOOLEAN           NOT NULL DEFAULT TRUE,
  delivery_method  "DeliveryMethod"  NOT NULL DEFAULT 'PICKUP',
  delivery_note    TEXT,
  delivery_cost    NUMERIC(10,2),
  view_count       INTEGER           NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ─── product_images ───────────────────────────────────────────────────────────
CREATE TABLE product_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  public_id   TEXT        NOT NULL,
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  "order"     INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── orders ───────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id         UUID            NOT NULL REFERENCES users(id),
  seller_id        UUID            NOT NULL REFERENCES users(id),
  status           "OrderStatus"   NOT NULL DEFAULT 'PENDING',
  total_amount     NUMERIC(12,2)   NOT NULL,
  platform_fee     NUMERIC(12,2)   NOT NULL,
  discount_amount  NUMERIC(12,2)   NOT NULL DEFAULT 0,
  payment_method   "PaymentMethod",
  delivery_address TEXT,
  delivery_note    TEXT,
  tracking_code    VARCHAR(100),
  dispute_reason   TEXT,
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─── order_items ──────────────────────────────────────────────────────────────
CREATE TABLE order_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id),
  quantity     INTEGER       NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  total_price  NUMERIC(12,2) NOT NULL
);

-- ─── payments ─────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID            NOT NULL UNIQUE REFERENCES orders(id),
  user_id         UUID            NOT NULL REFERENCES users(id),
  method          "PaymentMethod" NOT NULL,
  amount          NUMERIC(12,2)   NOT NULL,
  status          "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  transaction_id  VARCHAR(200),
  external_ref    VARCHAR(200),
  phone           VARCHAR(20),
  failure_reason  TEXT,
  initiated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ─── escrows ──────────────────────────────────────────────────────────────────
CREATE TABLE escrows (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID           NOT NULL UNIQUE REFERENCES orders(id),
  amount        NUMERIC(12,2)  NOT NULL,
  status        "EscrowStatus" NOT NULL DEFAULT 'HELD',
  held_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  released_at   TIMESTAMPTZ,
  refunded_at   TIMESTAMPTZ,
  release_reason TEXT
);

-- ─── conversations ────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id     UUID        NOT NULL REFERENCES users(id),
  user2_id     UUID        NOT NULL REFERENCES users(id),
  last_message TEXT,
  last_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user1_id, user2_id)
);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES users(id),
  receiver_id      UUID        NOT NULL REFERENCES users(id),
  text             TEXT,
  image_url        TEXT,
  is_fraud_flag    BOOLEAN     NOT NULL DEFAULT FALSE,
  fraud_reason     TEXT,
  is_read          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL UNIQUE REFERENCES orders(id),
  product_id   UUID        NOT NULL REFERENCES products(id),
  reviewer_id  UUID        NOT NULL REFERENCES users(id),
  seller_id    UUID        NOT NULL REFERENCES users(id),
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── reports ──────────────────────────────────────────────────────────────────
CREATE TABLE reports (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    UUID           NOT NULL REFERENCES users(id),
  reported_id    UUID           NOT NULL REFERENCES users(id),
  reason         VARCHAR(200)   NOT NULL,
  description    TEXT           NOT NULL DEFAULT '',
  evidence_urls  TEXT[]         NOT NULL DEFAULT '{}',
  status         "ReportStatus" NOT NULL DEFAULT 'PENDING',
  resolution     TEXT,
  reviewed_by    UUID           REFERENCES users(id),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

-- ─── notifications ────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       "NotificationType"  NOT NULL,
  title      VARCHAR(200)        NOT NULL,
  body       TEXT                NOT NULL,
  data       JSONB,
  is_read    BOOLEAN             NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ─── wishlist_items ───────────────────────────────────────────────────────────
CREATE TABLE wishlist_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

-- ─── delivery_tracking ────────────────────────────────────────────────────────
CREATE TABLE delivery_tracking (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     VARCHAR(100) NOT NULL,
  note       TEXT,
  location   VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── promotions ───────────────────────────────────────────────────────────────
CREATE TABLE promotions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50)   NOT NULL UNIQUE,
  discount_type    VARCHAR(20)   NOT NULL, -- PERCENTAGE | FIXED
  discount_value   NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(12,2),
  max_uses         INTEGER,
  used_count       INTEGER       NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
--  INDEXES (for query performance)
-- ============================================================
CREATE INDEX idx_users_phone              ON users(phone);
CREATE INDEX idx_users_role               ON users(role);
CREATE INDEX idx_users_district           ON users(district);
CREATE INDEX idx_otp_phone_used           ON otp_codes(phone, used);
CREATE INDEX idx_otp_expires              ON otp_codes(expires_at);
CREATE INDEX idx_products_seller          ON products(seller_id);
CREATE INDEX idx_products_category        ON products(category);
CREATE INDEX idx_products_district        ON products(district);
CREATE INDEX idx_products_status          ON products(status);
CREATE INDEX idx_products_price           ON products(price);
CREATE INDEX idx_products_created         ON products(created_at DESC);
CREATE INDEX idx_product_images_product   ON product_images(product_id);
CREATE INDEX idx_orders_buyer             ON orders(buyer_id);
CREATE INDEX idx_orders_seller            ON orders(seller_id);
CREATE INDEX idx_orders_status            ON orders(status);
CREATE INDEX idx_orders_created           ON orders(created_at DESC);
CREATE INDEX idx_order_items_order        ON order_items(order_id);
CREATE INDEX idx_order_items_product      ON order_items(product_id);
CREATE INDEX idx_payments_order           ON payments(order_id);
CREATE INDEX idx_payments_user            ON payments(user_id);
CREATE INDEX idx_payments_status          ON payments(status);
CREATE INDEX idx_escrows_order            ON escrows(order_id);
CREATE INDEX idx_escrows_status           ON escrows(status);
CREATE INDEX idx_conversations_user1      ON conversations(user1_id);
CREATE INDEX idx_conversations_user2      ON conversations(user2_id);
CREATE INDEX idx_messages_conversation    ON messages(conversation_id);
CREATE INDEX idx_messages_sender          ON messages(sender_id);
CREATE INDEX idx_messages_receiver        ON messages(receiver_id);
CREATE INDEX idx_messages_read            ON messages(is_read);
CREATE INDEX idx_reviews_seller           ON reviews(seller_id);
CREATE INDEX idx_reviews_product          ON reviews(product_id);
CREATE INDEX idx_reports_reported         ON reports(reported_id);
CREATE INDEX idx_reports_status           ON reports(status);
CREATE INDEX idx_notifications_user       ON notifications(user_id);
CREATE INDEX idx_notifications_read       ON notifications(is_read);
CREATE INDEX idx_notifications_created    ON notifications(created_at DESC);
CREATE INDEX idx_wishlist_user            ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_product         ON wishlist_items(product_id);
CREATE INDEX idx_delivery_order           ON delivery_tracking(order_id);

-- ============================================================
--  TRIGGERS (auto-update updated_at columns)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
--  SEED DATA
-- ============================================================

-- ─── Admin user  (password: Admin@Malonda2024) ────────────────────────────────
INSERT INTO users (id, phone, name, password_hash, role, location, district, verification_level, is_seller, trust_score)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  '+265888000001',
  'Malonda Admin',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj2sBfGQhGSa',  -- Admin@Malonda2024
  'ADMIN',
  'Lilongwe City',
  'Lilongwe',
  'TRUSTED',
  FALSE,
  100
);

-- ─── Trusted Seller  (password: Seller@123) ───────────────────────────────────
INSERT INTO users (id, phone, name, password_hash, role, location, district, verification_level, is_seller, trust_score)
VALUES (
  'b2000000-0000-0000-0000-000000000002',
  '+265999876543',
  'John Phiri',
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uSD1Sg0bm',  -- Seller@123
  'SELLER',
  'Lilongwe, Area 18',
  'Lilongwe',
  'TRUSTED',
  TRUE,
  88
);

-- ─── Verified Seller  (password: Seller@123) ──────────────────────────────────
INSERT INTO users (id, phone, name, password_hash, role, location, district, verification_level, is_seller, trust_score)
VALUES (
  'b3000000-0000-0000-0000-000000000003',
  '+265994112233',
  'Amina Shop',
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uSD1Sg0bm',  -- Seller@123
  'SELLER',
  'Blantyre, Limbe',
  'Blantyre',
  'VERIFIED',
  TRUE,
  72
);

-- ─── Basic Seller  (password: Seller@123) ─────────────────────────────────────
INSERT INTO users (id, phone, name, password_hash, role, location, district, verification_level, is_seller, trust_score)
VALUES (
  'b4000000-0000-0000-0000-000000000004',
  '+265887654321',
  'Grace Mbewe',
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uSD1Sg0bm',  -- Seller@123
  'SELLER',
  'Mzuzu, Area 2',
  'Mzuzu',
  'BASIC',
  TRUE,
  35
);

-- ─── Verified Buyer  (password: Buyer@123) ────────────────────────────────────
INSERT INTO users (id, phone, name, password_hash, role, location, district, verification_level, is_seller, trust_score)
VALUES (
  'c1000000-0000-0000-0000-000000000005',
  '+265881234567',
  'Chisomo Banda',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- Buyer@123
  'BUYER',
  'Lilongwe, Area 25',
  'Lilongwe',
  'VERIFIED',
  FALSE,
  72
);

-- ─── Basic Buyer (password: Buyer@123) ────────────────────────────────────────
INSERT INTO users (id, phone, name, password_hash, role, location, district, verification_level, is_seller, trust_score)
VALUES (
  'c2000000-0000-0000-0000-000000000006',
  '+265882345678',
  'Kondwani Tembo',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- Buyer@123
  'BUYER',
  'Blantyre, Chirimba',
  'Blantyre',
  'BASIC',
  FALSE,
  20
);

-- ─── Verifications for verified users ────────────────────────────────────────
INSERT INTO verifications (user_id, national_id_url, selfie_url, national_id_no, status, reviewed_by, reviewed_at)
VALUES
  ('b2000000-0000-0000-0000-000000000002', 'https://res.cloudinary.com/malonda/id/john_phiri_id.webp',   'https://res.cloudinary.com/malonda/selfies/john_phiri_selfie.webp',   'MWI-2021-304871', 'APPROVED', 'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days'),
  ('b3000000-0000-0000-0000-000000000003', 'https://res.cloudinary.com/malonda/id/amina_shop_id.webp',   'https://res.cloudinary.com/malonda/selfies/amina_shop_selfie.webp',   'MWI-2022-198432', 'APPROVED', 'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '15 days'),
  ('c1000000-0000-0000-0000-000000000005', 'https://res.cloudinary.com/malonda/id/chisomo_banda_id.webp','https://res.cloudinary.com/malonda/selfies/chisomo_banda_selfie.webp', 'MWI-2023-076219', 'APPROVED', 'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '7 days');

-- ─── Products ─────────────────────────────────────────────────────────────────
INSERT INTO products (id, seller_id, name, description, price, quantity, category, location, district, status, escrow_enabled, delivery_method, delivery_note, delivery_cost)
VALUES
  ('p1000000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000002',
   'Tecno Spark 10',
   'Brand new Tecno Spark 10, 6.6" display, 128GB storage, 8GB RAM, 5000mAh battery. Sealed box with original receipt. No scratches.',
   75000.00, 3, 'Electronics', 'Lilongwe, Area 18', 'Lilongwe',
   'ACTIVE', TRUE, 'LOCAL_DELIVERY', 'Delivery within Lilongwe MK 500. Free pick-up from Area 18.', 500.00),

  ('p2000000-0000-0000-0000-000000000002',
   'b2000000-0000-0000-0000-000000000002',
   'Wooden Dining Table (6-Seater)',
   'Handcrafted solid mahogany dining table, seats 6. Smooth finish, dark brown colour. Free delivery within Lilongwe city.',
   95000.00, 1, 'Furniture', 'Lilongwe, Area 3', 'Lilongwe',
   'ACTIVE', TRUE, 'LOCAL_DELIVERY', 'Free delivery in Lilongwe. Outside Lilongwe negotiable.', 0.00),

  ('p3000000-0000-0000-0000-000000000003',
   'b3000000-0000-0000-0000-000000000003',
   'Chitenje Fabric (5 Metres)',
   'Premium Malawian chitenje fabric, 5 metres. Multiple patterns available — blue geometric, green floral, orange traditional. Perfect for dresses.',
   8500.00, 20, 'Clothing', 'Blantyre, Limbe', 'Blantyre',
   'ACTIVE', TRUE, 'LOCAL_DELIVERY', 'Delivery within Blantyre MK 300. Nationwide shipping available.', 300.00),

  ('p4000000-0000-0000-0000-000000000004',
   'b3000000-0000-0000-0000-000000000003',
   'Ladies Leather Handbag',
   'Genuine leather handbag, black colour, multiple compartments. Imported quality. Perfect for office or casual use.',
   22000.00, 5, 'Clothing', 'Blantyre, City Centre', 'Blantyre',
   'ACTIVE', TRUE, 'NATIONWIDE', 'Nationwide delivery available. Cost depends on location.', NULL),

  ('p5000000-0000-0000-0000-000000000005',
   'b4000000-0000-0000-0000-000000000004',
   'Fresh Tomatoes (1kg)',
   'Fresh farm tomatoes, 1kg bag. Picked daily from our garden. Great for cooking. Bulk orders available at discount.',
   1500.00, 100, 'Food', 'Mzuzu, Area 2', 'Mzuzu',
   'ACTIVE', FALSE, 'PICKUP', 'Pick up from Area 2, Mzuzu. Local delivery possible for large orders.', NULL),

  ('p6000000-0000-0000-0000-000000000006',
   'b2000000-0000-0000-0000-000000000002',
   'Solar Panel Kit 100W',
   'Complete solar kit: 100W monocrystalline panel, 12V 100Ah battery, 1000W inverter, wiring cables, charge controller. Installation available.',
   125000.00, 2, 'Electronics', 'Lilongwe, Area 47', 'Lilongwe',
   'ACTIVE', TRUE, 'LOCAL_DELIVERY', 'Free delivery + installation within Lilongwe. Transport fee outside.', 0.00),

  ('p7000000-0000-0000-0000-000000000007',
   'b4000000-0000-0000-0000-000000000004',
   'Maize Flour 25kg (Ufa Woyera)',
   'Pure ufa woyera, freshly milled 25kg bag. Directly from our Kasungu farm. Wholesale prices for bulk orders (5+ bags).',
   18000.00, 50, 'Food', 'Kasungu Town', 'Kasungu',
   'ACTIVE', TRUE, 'NATIONWIDE', 'Can arrange transport. Cost negotiable for bulk.', NULL),

  ('p8000000-0000-0000-0000-000000000008',
   'b3000000-0000-0000-0000-000000000003',
   'Samsung Galaxy A14 (Used)',
   'Samsung Galaxy A14, 64GB, 4GB RAM. Used for 8 months, excellent condition. Screen protector always on. Comes with charger and box.',
   45000.00, 1, 'Electronics', 'Blantyre, Ndirande', 'Blantyre',
   'ACTIVE', TRUE, 'LOCAL_DELIVERY', 'Meet in Blantyre City Centre or delivery available.', 500.00);

-- ─── Product images ───────────────────────────────────────────────────────────
INSERT INTO product_images (product_id, url, public_id, is_primary, "order")
VALUES
  ('p1000000-0000-0000-0000-000000000001','https://res.cloudinary.com/malonda/products/tecno_spark10_1.webp','malonda/products/tecno1',TRUE,0),
  ('p1000000-0000-0000-0000-000000000001','https://res.cloudinary.com/malonda/products/tecno_spark10_2.webp','malonda/products/tecno2',FALSE,1),
  ('p2000000-0000-0000-0000-000000000002','https://res.cloudinary.com/malonda/products/dining_table_1.webp','malonda/products/table1',TRUE,0),
  ('p3000000-0000-0000-0000-000000000003','https://res.cloudinary.com/malonda/products/chitenje_1.webp','malonda/products/chitenje1',TRUE,0),
  ('p4000000-0000-0000-0000-000000000004','https://res.cloudinary.com/malonda/products/handbag_1.webp','malonda/products/bag1',TRUE,0),
  ('p5000000-0000-0000-0000-000000000005','https://res.cloudinary.com/malonda/products/tomatoes_1.webp','malonda/products/tomatoes1',TRUE,0),
  ('p6000000-0000-0000-0000-000000000006','https://res.cloudinary.com/malonda/products/solar_kit_1.webp','malonda/products/solar1',TRUE,0),
  ('p7000000-0000-0000-0000-000000000007','https://res.cloudinary.com/malonda/products/maize_flour_1.webp','malonda/products/maize1',TRUE,0),
  ('p8000000-0000-0000-0000-000000000008','https://res.cloudinary.com/malonda/products/samsung_a14_1.webp','malonda/products/samsung1',TRUE,0);

-- ─── Orders ───────────────────────────────────────────────────────────────────
INSERT INTO orders (id, buyer_id, seller_id, status, total_amount, platform_fee, discount_amount, payment_method, delivery_address, created_at)
VALUES
  -- Completed order (Chisomo bought Chitenje)
  ('o1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000005',
   'b3000000-0000-0000-0000-000000000003',
   'COMPLETED', 8670.00, 170.00, 0.00,
   'AIRTEL_MONEY', 'Lilongwe, Area 25, near Shoprite',
   NOW() - INTERVAL '15 days'),

  -- Escrowed order (Chisomo buying Tecno Spark)
  ('o2000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000005',
   'b2000000-0000-0000-0000-000000000002',
   'ESCROWED', 75500.00, 1500.00, 0.00,
   'AIRTEL_MONEY', 'Lilongwe, Area 25',
   NOW() - INTERVAL '3 days'),

  -- Delivered order (awaiting confirmation)
  ('o3000000-0000-0000-0000-000000000003',
   'c2000000-0000-0000-0000-000000000006',
   'b3000000-0000-0000-0000-000000000003',
   'DELIVERED', 22440.00, 440.00, 0.00,
   'TNM_MPAMBA', 'Blantyre, Chirimba',
   NOW() - INTERVAL '5 days'),

  -- Pending order (Kondwani, COD)
  ('o4000000-0000-0000-0000-000000000004',
   'c2000000-0000-0000-0000-000000000006',
   'b4000000-0000-0000-0000-000000000004',
   'PENDING', 18360.00, 360.00, 0.00,
   'CASH_ON_DELIVERY', 'Blantyre, Chirimba Market',
   NOW() - INTERVAL '1 day');

-- ─── Order Items ──────────────────────────────────────────────────────────────
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
VALUES
  ('o1000000-0000-0000-0000-000000000001','p3000000-0000-0000-0000-000000000003', 1, 8500.00, 8500.00),
  ('o2000000-0000-0000-0000-000000000002','p1000000-0000-0000-0000-000000000001', 1,75000.00,75000.00),
  ('o3000000-0000-0000-0000-000000000003','p4000000-0000-0000-0000-000000000004', 1,22000.00,22000.00),
  ('o4000000-0000-0000-0000-000000000004','p7000000-0000-0000-0000-000000000007', 1,18000.00,18000.00);

-- ─── Payments ─────────────────────────────────────────────────────────────────
INSERT INTO payments (order_id, user_id, method, amount, status, transaction_id, external_ref, phone, initiated_at, completed_at)
VALUES
  ('o1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000005','AIRTEL_MONEY', 8670.00,'SUCCESS','AT-TXN-001','MALONDA-00000001','+265881234567', NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days'),
  ('o2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000005','AIRTEL_MONEY',75500.00,'SUCCESS','AT-TXN-002','MALONDA-00000002','+265881234567', NOW()-INTERVAL '3 days',  NOW()-INTERVAL '3 days'),
  ('o3000000-0000-0000-0000-000000000003','c2000000-0000-0000-0000-000000000006','TNM_MPAMBA',  22440.00,'SUCCESS','TNM-TXN-001','MALONDA-00000003','+265882345678', NOW()-INTERVAL '5 days',  NOW()-INTERVAL '5 days');

-- ─── Escrows ──────────────────────────────────────────────────────────────────
INSERT INTO escrows (order_id, amount, status, held_at, released_at)
VALUES
  ('o1000000-0000-0000-0000-000000000001', 8670.00, 'RELEASED', NOW()-INTERVAL '15 days', NOW()-INTERVAL '14 days'),
  ('o2000000-0000-0000-0000-000000000002',75500.00, 'HELD',     NOW()-INTERVAL '3 days',  NULL),
  ('o3000000-0000-0000-0000-000000000003',22440.00, 'HELD',     NOW()-INTERVAL '5 days',  NULL);

-- ─── Conversations & Messages ─────────────────────────────────────────────────
INSERT INTO conversations (id, user1_id, user2_id, last_message, last_at)
VALUES
  ('cv100000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000005',
   'Yes still available! Are you in Lilongwe?',
   NOW() - INTERVAL '2 hours'),
  ('cv200000-0000-0000-0000-000000000002',
   'b3000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000005',
   'Thank you for your purchase!',
   NOW() - INTERVAL '14 days');

INSERT INTO messages (conversation_id, sender_id, receiver_id, text, is_read, created_at)
VALUES
  ('cv100000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000005','b2000000-0000-0000-0000-000000000002','Moni! Is the Tecno Spark 10 still available?',      TRUE,  NOW()-INTERVAL '3 hours'),
  ('cv100000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000005','Yes still available! Are you in Lilongwe?',         TRUE,  NOW()-INTERVAL '2 hours 55 minutes'),
  ('cv100000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000005','b2000000-0000-0000-0000-000000000002','Yes, Area 25. Can you do MK 70,000?',               TRUE,  NOW()-INTERVAL '2 hours 50 minutes'),
  ('cv100000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000005','Best I can do is MK 73,000. It is brand new sealed!',FALSE, NOW()-INTERVAL '2 hours'),
  ('cv200000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000005','b3000000-0000-0000-0000-000000000003','I received the chitenje, it is beautiful!',          TRUE,  NOW()-INTERVAL '14 days'),
  ('cv200000-0000-0000-0000-000000000002','b3000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000005','Thank you for your purchase!',                       TRUE,  NOW()-INTERVAL '14 days');

-- ─── Reviews ──────────────────────────────────────────────────────────────────
INSERT INTO reviews (order_id, product_id, reviewer_id, seller_id, rating, text, created_at)
VALUES
  ('o1000000-0000-0000-0000-000000000001',
   'p3000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000005',
   'b3000000-0000-0000-0000-000000000003',
   5,
   'Beautiful fabric! Exactly as described. Amina was very helpful and delivery was fast. Will definitely buy again!',
   NOW() - INTERVAL '13 days');

-- ─── Delivery Tracking ────────────────────────────────────────────────────────
INSERT INTO delivery_tracking (order_id, status, note, location, created_at)
VALUES
  ('o1000000-0000-0000-0000-000000000001','DISPATCHED','Order packed and ready for delivery','Blantyre, Limbe',NOW()-INTERVAL '15 days'),
  ('o1000000-0000-0000-0000-000000000001','DELIVERED', 'Delivered to buyer in Lilongwe Area 25','Lilongwe, Area 25',NOW()-INTERVAL '14 days'),
  ('o2000000-0000-0000-0000-000000000002','DISPATCHED','Phone dispatched, on the way to buyer','Lilongwe, Area 18',NOW()-INTERVAL '1 day'),
  ('o3000000-0000-0000-0000-000000000003','DISPATCHED','Handbag packaged and sent','Blantyre, City Centre',NOW()-INTERVAL '4 days'),
  ('o3000000-0000-0000-0000-000000000003','DELIVERED', 'Delivered to buyer in Chirimba','Blantyre, Chirimba',NOW()-INTERVAL '2 days');

-- ─── Notifications ────────────────────────────────────────────────────────────
INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at)
VALUES
  ('c1000000-0000-0000-0000-000000000005','PAYMENT_ESCROWED','Payment in Escrow 🔒',
   'Your payment of MK 75,500 is safely held in escrow for Tecno Spark 10.',
   '{"orderId":"o2000000-0000-0000-0000-000000000002"}', FALSE, NOW()-INTERVAL '3 days'),

  ('c1000000-0000-0000-0000-000000000005','ORDER_DISPATCHED','Order Dispatched! 📦',
   'Your Tecno Spark 10 has been dispatched. Arriving soon!',
   '{"orderId":"o2000000-0000-0000-0000-000000000002"}', FALSE, NOW()-INTERVAL '1 day'),

  ('b2000000-0000-0000-0000-000000000002','ORDER_PLACED','New Order Received! 🛒',
   'Chisomo Banda placed an order for Tecno Spark 10. Payment is in escrow.',
   '{"orderId":"o2000000-0000-0000-0000-000000000002"}', TRUE, NOW()-INTERVAL '3 days'),

  ('b3000000-0000-0000-0000-000000000003','ESCROW_RELEASED','Payment Released! 💰',
   'Payment of MK 8,670 has been released to your account for the Chitenje Fabric order.',
   '{"orderId":"o1000000-0000-0000-0000-000000000001"}', TRUE, NOW()-INTERVAL '14 days'),

  ('b3000000-0000-0000-0000-000000000003','NEW_REVIEW','New 5-Star Review ⭐',
   'Chisomo Banda left you a 5-star review for Chitenje Fabric.',
   '{"productId":"p3000000-0000-0000-0000-000000000003"}', TRUE, NOW()-INTERVAL '13 days'),

  ('c1000000-0000-0000-0000-000000000005','VERIFICATION_APPROVED','ID Verified! ✓',
   'Congratulations! Your National ID has been verified. You now have the Verified badge.',
   '{}', TRUE, NOW()-INTERVAL '7 days');

-- ─── Wishlist ─────────────────────────────────────────────────────────────────
INSERT INTO wishlist_items (user_id, product_id)
VALUES
  ('c1000000-0000-0000-0000-000000000005','p1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005','p6000000-0000-0000-0000-000000000006'),
  ('c2000000-0000-0000-0000-000000000006','p3000000-0000-0000-0000-000000000003'),
  ('c2000000-0000-0000-0000-000000000006','p8000000-0000-0000-0000-000000000008');

-- ─── Promotions ───────────────────────────────────────────────────────────────
INSERT INTO promotions (code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active)
VALUES
  ('MALONDA10', 'PERCENTAGE', 10.00,  5000.00, 1000, 3, NOW() + INTERVAL '90 days', TRUE),
  ('WELCOME',   'FIXED',     2000.00, 10000.00,  500, 0, NOW() + INTERVAL '60 days', TRUE),
  ('SAVE500',   'FIXED',      500.00,  3000.00, 2000, 12,NOW() + INTERVAL '30 days', TRUE);

-- ─── Sample report ────────────────────────────────────────────────────────────
INSERT INTO reports (reporter_id, reported_id, reason, description, status, created_at)
VALUES
  ('c2000000-0000-0000-0000-000000000006',
   'b4000000-0000-0000-0000-000000000004',
   'Asked for payment outside platform',
   'Seller asked me to send money via bank transfer instead of using Malonda escrow payment.',
   'PENDING',
   NOW() - INTERVAL '2 days');

-- ============================================================
--  VIEWS (useful for reporting and dashboards)
-- ============================================================

-- Seller summary view
CREATE OR REPLACE VIEW seller_summary AS
SELECT
  u.id,
  u.name,
  u.phone,
  u.verification_level,
  u.trust_score,
  u.district,
  COUNT(DISTINCT p.id)               AS product_count,
  COUNT(DISTINCT o.id)               AS total_orders,
  COUNT(DISTINCT CASE WHEN o.status='COMPLETED' THEN o.id END) AS completed_orders,
  COALESCE(SUM(CASE WHEN o.status='COMPLETED' THEN o.total_amount END), 0) AS total_revenue,
  ROUND(AVG(r.rating)::NUMERIC, 1)   AS avg_rating,
  COUNT(DISTINCT r.id)               AS review_count
FROM users u
LEFT JOIN products p   ON p.seller_id = u.id AND p.status = 'ACTIVE'
LEFT JOIN orders o     ON o.seller_id = u.id
LEFT JOIN reviews r    ON r.seller_id = u.id
WHERE u.is_seller = TRUE
GROUP BY u.id;

-- Active escrow view
CREATE OR REPLACE VIEW active_escrows AS
SELECT
  e.id            AS escrow_id,
  e.amount,
  e.held_at,
  o.id            AS order_id,
  o.status        AS order_status,
  buyer.name      AS buyer_name,
  buyer.phone     AS buyer_phone,
  seller.name     AS seller_name,
  seller.phone    AS seller_phone
FROM escrows e
JOIN orders o      ON o.id = e.order_id
JOIN users buyer   ON buyer.id = o.buyer_id
JOIN users seller  ON seller.id = o.seller_id
WHERE e.status = 'HELD';

-- Product performance view
CREATE OR REPLACE VIEW product_performance AS
SELECT
  p.id,
  p.name,
  p.price,
  p.category,
  p.district,
  p.view_count,
  p.status,
  u.name          AS seller_name,
  u.verification_level AS seller_badge,
  COUNT(oi.id)    AS times_ordered,
  ROUND(AVG(r.rating)::NUMERIC, 1) AS avg_rating,
  COUNT(r.id)     AS review_count
FROM products p
JOIN users u              ON u.id = p.seller_id
LEFT JOIN order_items oi  ON oi.product_id = p.id
LEFT JOIN reviews r       ON r.product_id  = p.id
GROUP BY p.id, u.id;

-- ============================================================
--  FINAL CHECKS
-- ============================================================
DO $$
DECLARE
  u_count  INT;
  p_count  INT;
  o_count  INT;
BEGIN
  SELECT COUNT(*) INTO u_count FROM users;
  SELECT COUNT(*) INTO p_count FROM products;
  SELECT COUNT(*) INTO o_count FROM orders;
  RAISE NOTICE '✅ Malonda DB ready — Users: %, Products: %, Orders: %', u_count, p_count, o_count;
END $$;
