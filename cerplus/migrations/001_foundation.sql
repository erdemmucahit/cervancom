CREATE TABLE app_meta (key text PRIMARY KEY, value text NOT NULL);
INSERT INTO app_meta VALUES ('dataset', 'empty');
CREATE TABLE dealers (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','operations','team','dealer')),
  dealer_id uuid REFERENCES dealers(id), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role='dealer' AND dealer_id IS NOT NULL) OR (role<>'dealer' AND dealer_id IS NULL))
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  csrf text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE login_attempts (id uuid PRIMARY KEY, account_hash text NOT NULL, ip_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX login_attempts_time ON login_attempts(created_at);
CREATE TABLE brands (id uuid PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE products (
  id uuid PRIMARY KEY, brand_id uuid NOT NULL REFERENCES brands(id),
  code text NOT NULL, model text NOT NULL, variant text NOT NULL DEFAULT '',
  assembly_minutes integer NOT NULL DEFAULT 0 CHECK(assembly_minutes>=0 AND assembly_minutes<=1440),
  UNIQUE(brand_id,code,variant), UNIQUE(id,brand_id)
);
CREATE TABLE package_types (
  id uuid PRIMARY KEY, product_id uuid NOT NULL, brand_id uuid NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0), total integer NOT NULL CHECK(total>0 AND total<=100),
  required_quantity integer NOT NULL CHECK(required_quantity>0 AND required_quantity<=100),
  barcode text NOT NULL, volume_m3 numeric(12,6) NOT NULL CHECK(volume_m3>0),
  weight_kg numeric(12,6) NOT NULL CHECK(weight_kg>0),
  FOREIGN KEY(product_id,brand_id) REFERENCES products(id,brand_id),
  CHECK(sequence<=total), UNIQUE(product_id,sequence), UNIQUE(brand_id,barcode)
);
CREATE TABLE sections (id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL);
CREATE TABLE racks (
  id uuid PRIMARY KEY, section_id uuid NOT NULL REFERENCES sections(id), code text NOT NULL UNIQUE,
  capacity_m3 numeric(12,6) CHECK(capacity_m3>0), active boolean NOT NULL DEFAULT true
);
CREATE TABLE receipts (
  id uuid PRIMARY KEY, idempotency_key text NOT NULL UNIQUE, payload_hash text NOT NULL, source text NOT NULL CHECK(source IN ('manual','xlsx','seed')),
  reference text NOT NULL, owner_key text NOT NULL, dealer_id uuid REFERENCES dealers(id),
  actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((dealer_id IS NULL AND owner_key='common') OR (dealer_id IS NOT NULL AND owner_key=dealer_id::text))
);
CREATE TABLE receipt_lines (
  id uuid PRIMARY KEY, receipt_id uuid NOT NULL REFERENCES receipts(id), package_type_id uuid NOT NULL REFERENCES package_types(id),
  rack_id uuid NOT NULL REFERENCES racks(id), quantity integer NOT NULL CHECK(quantity>0)
);
CREATE TABLE stock (
  id uuid PRIMARY KEY, rack_id uuid NOT NULL REFERENCES racks(id), package_type_id uuid NOT NULL REFERENCES package_types(id),
  owner_key text NOT NULL, dealer_id uuid REFERENCES dealers(id), physical integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0, protected integer NOT NULL DEFAULT 0,
  CHECK(physical>=0 AND reserved>=0 AND protected>=0 AND physical>=reserved+protected),
  CHECK ((dealer_id IS NULL AND owner_key='common') OR (dealer_id IS NOT NULL AND owner_key=dealer_id::text)),
  UNIQUE(rack_id,package_type_id,owner_key)
);
CREATE INDEX stock_owner ON stock(dealer_id);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY, stock_id uuid NOT NULL REFERENCES stock(id),
  kind text NOT NULL CHECK(kind IN ('receipt','transfer_in','transfer_out','damage','reserve','release','dispatch','return_acceptance')),
  quantity integer NOT NULL CHECK(quantity<>0), actor_id uuid NOT NULL REFERENCES users(id),
  reference text NOT NULL, operation_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_stock ON stock_movements(stock_id,created_at);
CREATE TABLE inventory_operations (idempotency_key text PRIMARY KEY, payload_hash text NOT NULL, result jsonb NOT NULL);
CREATE TABLE import_previews (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('catalog','receipt')),
  digest text NOT NULL, payload jsonb NOT NULL, errors jsonb NOT NULL, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes'
);
CREATE TABLE imports (digest text PRIMARY KEY, kind text NOT NULL, result jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_log (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL,
  entity text NOT NULL, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
