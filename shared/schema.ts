import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Projects table - represents individual Microsoft Project files or programs
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"), // active, completed, on-hold
  necCompliant: boolean("nec_compliant"),
  projectManager: text("project_manager"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tasks table - individual project tasks/activities
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
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
});

// DCMA 14-point assessments
export const dcmaAssessments = pgTable("dcma_assessments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assessmentDate: timestamp("assessment_date").defaultNow().notNull(),
  
  // 14 DCMA metrics (boolean pass/fail for each)
  logicComplete: boolean("logic_complete"), // 1. Logic is complete
  leadLagsValid: boolean("lead_lags_valid"), // 2. Leads & lags are valid
  hardConstraintsValid: boolean("hard_constraints_valid"), // 3. Hard constraints are valid
  negativeLagsValid: boolean("negative_lags_valid"), // 4. Negative lags are valid
  highDurationValid: boolean("high_duration_valid"), // 5. High duration activities are valid
  invalidDatesValid: boolean("invalid_dates_valid"), // 6. Invalid dates are valid
  resourcesAssigned: boolean("resources_assigned"), // 7. Resources are assigned
  missedTasksValid: boolean("missed_tasks_valid"), // 8. Missed tasks are valid
  highFloatValid: boolean("high_float_valid"), // 9. High float tasks are valid
  criticalPathTest: boolean("critical_path_test"), // 10. Critical path test
  criticalPathLength: boolean("critical_path_length"), // 11. Critical path length is valid
  baselineExists: boolean("baseline_exists"), // 12. Baseline exists
  sviBvValid: boolean("svi_bv_valid"), // 13. SVI/BV is valid
  bcwsValid: boolean("bcws_valid"), // 14. BCWS is valid
  
  overallScore: integer("overall_score"), // 0-14
  passed: boolean("passed"), // true if score >= threshold
  notes: text("notes"),
});

// NEC Compliance checks
export const necCompliance = pgTable("nec_compliance", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assessmentDate: timestamp("assessment_date").defaultNow().notNull(),
  
  // NEC compliance criteria
  programmeDefined: boolean("programme_defined"), // Is there a defined programme?
  acceptedProgramme: boolean("accepted_programme"), // Has the programme been accepted?
  regularUpdates: boolean("regular_updates"), // Are regular updates provided?
  earlyWarningsManaged: boolean("early_warnings_managed"), // Are early warnings properly managed?
  compensationEventsTracked: boolean("compensation_events_tracked"), // Are compensation events tracked?
  keyDatesIdentified: boolean("key_dates_identified"), // Are key dates identified?
  completionDateRealistic: boolean("completion_date_realistic"), // Is the completion date realistic?
  resourcesAdequate: boolean("resources_adequate"), // Are resources adequate?
  
  overallCompliant: boolean("overall_compliant"),
  notes: text("notes"),
});

// Insert schemas
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

export const insertNecComplianceSchema = createInsertSchema(necCompliance).omit({
  id: true,
});

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type DcmaAssessment = typeof dcmaAssessments.$inferSelect;
export type InsertDcmaAssessment = z.infer<typeof insertDcmaAssessmentSchema>;

export type NecCompliance = typeof necCompliance.$inferSelect;
export type InsertNecCompliance = z.infer<typeof insertNecComplianceSchema>;
