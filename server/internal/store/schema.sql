CREATE TABLE IF NOT EXISTS menus (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
 currency text NOT NULL CHECK (currency = 'INR'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS menu_items (
 menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
 position integer NOT NULL,
 category text NOT NULL,
 name text NOT NULL,
 price_minor integer NOT NULL CHECK (price_minor > 0 AND price_minor <= 9999999),
 vegetarian boolean NOT NULL,
 variants jsonb NOT NULL CHECK (jsonb_typeof(variants) = 'array'),
 PRIMARY KEY (menu_id, position),
 UNIQUE(menu_id, category, name)
);

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='menus'::regclass AND conname='menus_currency_check') THEN
   ALTER TABLE menus DROP CONSTRAINT menus_currency_check;
   ALTER TABLE menus ADD CONSTRAINT menus_supported_currency CHECK (currency IN ('INR','USD'));
 END IF;
END $$;
