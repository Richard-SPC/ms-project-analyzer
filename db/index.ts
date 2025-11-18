import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

// Only initialize database if DATABASE_URL is available
export const db = process.env.DATABASE_URL 
  ? drizzle(neon(process.env.DATABASE_URL), { schema })
  : null;

export type DbClient = NonNullable<typeof db>;
