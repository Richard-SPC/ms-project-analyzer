import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Workspaces table - groups projects together for organization
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6"), // hex color for visual distinction
  projectManager: text("project_manager"),
  client: text("client"),
  status: text("status"), // Tender, Pre-Construction, On Site, Off Site, Commissioning, Complete
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Projects table - represents individual Microsoft Project files or programs
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  statusDate: timestamp("status_date"), // Reference date for DCMA check 11 (Late Tasks)
  status: text("status").notNull().default("active"), // active, completed, on-hold
  projectManager: text("project_manager"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tasks table - individual project tasks/activities
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  msProjectId: text("ms_project_id"), // Original MS Project ID (row number) for reference
  name: text("name").notNull(),
  wbsCode: text("wbs_code"), // Work Breakdown Structure code
  duration: integer("duration"), // in days
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  percentComplete: decimal("percent_complete", { precision: 5, scale: 2 }).default("0"),
  predecessors: text("predecessors").array(), // task dependencies
  resources: text("resources").array(),
  isCriticalPath: boolean("is_critical_path").default(false),
  totalFloat: integer("total_float"), // in days
  isMilestone: boolean("is_milestone").default(false),
  isSummary: boolean("is_summary").default(false), // summary tasks group subtasks
  constraintType: text("constraint_type"), // ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO
});

// Calendar exceptions - holidays and non-working days
export const calendarExceptions = pgTable("calendar_exceptions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  name: text("name").notNull(),
  calendarName: text("calendar_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DCMA 14-point assessments
export const dcmaAssessments = pgTable("dcma_assessments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assessmentDate: timestamp("assessment_date").defaultNow().notNull(),
  
  // 14 DCMA metrics (boolean pass/fail for each) - NEW REORDERED SEQUENCE
  missingLogic: boolean("missing_logic"), // 1. Missing Logic
  negativeLag: boolean("negative_lag"), // 2. Negative Lag
  leadsLags: boolean("leads_lags"), // 3. Leads & Lags
  relationshipTypes: boolean("relationship_types"), // 4. Relationship Type (NEW)
  hardConstraints: boolean("hard_constraints"), // 5. Hard Constraints
  largeFloat: boolean("large_float"), // 6. Large Float
  negativeFloat: boolean("negative_float"), // 7. Negative Float (NEW)
  largeDurations: boolean("large_durations"), // 8. Large Durations
  invalidTasks: boolean("invalid_tasks"), // 9. Invalid Tasks
  resourcesAssigned: boolean("resources_assigned"), // 10. Resources Assigned
  lateTasks: boolean("late_tasks"), // 11. Late Tasks
  criticalPathTest: boolean("critical_path_test"), // 12. Critical Path Test
  criticalPathLength: boolean("critical_path_length"), // 13. Critical Path Length
  baselineExecutionIndex: boolean("baseline_execution_index"), // 14. Baseline Execution Index
  
  // Manual overrides (when true, forces the check to pass regardless of automated result)
  missingLogicOverride: boolean("missing_logic_override").default(false),
  negativeLagOverride: boolean("negative_lag_override").default(false),
  leadsLagsOverride: boolean("leads_lags_override").default(false),
  relationshipTypesOverride: boolean("relationship_types_override").default(false),
  hardConstraintsOverride: boolean("hard_constraints_override").default(false),
  largeFloatOverride: boolean("large_float_override").default(false),
  negativeFloatOverride: boolean("negative_float_override").default(false),
  largeDurationsOverride: boolean("large_durations_override").default(false),
  invalidTasksOverride: boolean("invalid_tasks_override").default(false),
  resourcesAssignedOverride: boolean("resources_assigned_override").default(false),
  lateTasksOverride: boolean("late_tasks_override").default(false),
  criticalPathTestOverride: boolean("critical_path_test_override").default(false),
  criticalPathLengthOverride: boolean("critical_path_length_override").default(false),
  baselineExecutionIndexOverride: boolean("baseline_execution_index_override").default(false),
  
  overallScore: integer("overall_score"), // 0-14
  passed: boolean("passed"), // true if score >= threshold
  notes: text("notes"),
});


// Insert schemas
export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects, {
  startDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ).optional(),
  endDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ).optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks, {
  startDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ).optional(),
  endDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ).optional(),
}).omit({
  id: true,
});

export const insertDcmaAssessmentSchema = createInsertSchema(dcmaAssessments).omit({
  id: true,
});

export const insertCalendarExceptionSchema = createInsertSchema(calendarExceptions, {
  startDate: z.union([z.string(), z.date()]).transform((val) =>
    typeof val === 'string' ? new Date(val) : val
  ),
  endDate: z.union([z.string(), z.date()]).transform((val) =>
    typeof val === 'string' ? new Date(val) : val
  ),
}).omit({
  id: true,
  createdAt: true,
});

// Public holidays - editable source of truth for holiday compliance checking
export const publicHolidays = pgTable("public_holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  country: text("country").notNull().default("scotland"), // "scotland" | "england"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// App settings - key/value store for things like lock state
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertPublicHolidaySchema = createInsertSchema(publicHolidays, {
  date: z.union([z.string(), z.date()]).transform((val) =>
    typeof val === "string" ? new Date(val) : val
  ),
}).omit({ id: true, createdAt: true });

export type PublicHoliday = typeof publicHolidays.$inferSelect;
export type InsertPublicHoliday = z.infer<typeof insertPublicHolidaySchema>;

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").default("user"), // admin, user
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type DcmaAssessment = typeof dcmaAssessments.$inferSelect;
export type InsertDcmaAssessment = z.infer<typeof insertDcmaAssessmentSchema>;

export type CalendarException = typeof calendarExceptions.$inferSelect;
export type InsertCalendarException = z.infer<typeof insertCalendarExceptionSchema>;
