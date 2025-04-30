import { integer, pgTable, varchar, timestamp, text, boolean } from "drizzle-orm/pg-core"

export const scrapeQueue = pgTable("scrape_queue", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  url: varchar({ length: 1000 }).notNull(),
  status: varchar({ length: 255 }).notNull().default("pending"),
  sourceUrl: varchar({ length: 1000 }),
  depth: integer().notNull().default(0), // hops from seed
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  lastError: timestamp(),
})

export const searchData = pgTable("search_data", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  url: varchar({ length: 1000 }).notNull().unique(),
  title: varchar({ length: 255 }),
  description: varchar({ length: 1000 }),
  imageUrl: varchar({ length: 1000 }),
  keywords: text().array(),
  text: text(),
  links: text().array(),
  processed: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const linkRelations = pgTable("link_relations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  sourceId: integer().notNull().references(() => searchData.id),
  targetId: integer().notNull().references(() => searchData.id),
  createdAt: timestamp().notNull().defaultNow(),
})