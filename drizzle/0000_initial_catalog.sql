CREATE TYPE product_category AS ENUM (
  'outerwear',
  'tops',
  'bottoms',
  'dresses',
  'footwear',
  'accessories'
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category product_category NOT NULL,
  price numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  short_description text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL,
  image_alt text NOT NULL,
  image_description text NOT NULL,
  colors text[] NOT NULL,
  sizes text[] NOT NULL,
  material text NOT NULL,
  style_tags text[] NOT NULL,
  inventory integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_category_idx ON products (category);
CREATE INDEX products_style_tags_idx ON products USING gin (style_tags);
