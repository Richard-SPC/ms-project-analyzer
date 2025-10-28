import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  fileSize: text("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  extractedData: jsonb("extracted_data"),
  fullText: text("full_text"),
});

export const queries = pgTable("queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  uploadedAt: true,
});

export const insertQuerySchema = createInsertSchema(queries).omit({
  id: true,
  createdAt: true,
});

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertQuery = z.infer<typeof insertQuerySchema>;
export type Query = typeof queries.$inferSelect;

export interface ExtractedData {
  keyDates: Array<{ label: string; value: string | null; confidence: number }>;
  accessDates: Array<{ partOfSite: string; date: string }>;
  accessDetails: Array<{ label: string; value: string | null; confidence: number }>;
  damages: Array<{ label: string; value: string | null; confidence: number }>;
}
