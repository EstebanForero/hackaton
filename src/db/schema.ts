import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const productCategory = pgEnum('product_category', [
  'outerwear',
  'tops',
  'bottoms',
  'dresses',
  'footwear',
  'accessories',
])

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  category: productCategory('category').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  shortDescription: text('short_description').notNull(),
  description: text('description').notNull(),
  imageUrl: text('image_url').notNull(),
  imageAlt: text('image_alt').notNull(),
  imageDescription: text('image_description').notNull(),
  colors: text('colors').array().notNull(),
  sizes: text('sizes').array().notNull(),
  material: text('material').notNull(),
  styleTags: text('style_tags').array().notNull(),
  inventory: integer('inventory').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
