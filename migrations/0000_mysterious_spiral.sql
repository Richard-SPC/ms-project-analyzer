CREATE TABLE "dcma_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"assessment_date" timestamp DEFAULT now() NOT NULL,
	"missing_logic" boolean,
	"negative_lag" boolean,
	"leads_lags" boolean,
	"relationship_types" boolean,
	"hard_constraints" boolean,
	"large_float" boolean,
	"negative_float" boolean,
	"large_durations" boolean,
	"invalid_tasks" boolean,
	"resources_assigned" boolean,
	"late_tasks" boolean,
	"critical_path_test" boolean,
	"critical_path_length" boolean,
	"baseline_execution_index" boolean,
	"missing_logic_override" boolean DEFAULT false,
	"negative_lag_override" boolean DEFAULT false,
	"leads_lags_override" boolean DEFAULT false,
	"relationship_types_override" boolean DEFAULT false,
	"hard_constraints_override" boolean DEFAULT false,
	"large_float_override" boolean DEFAULT false,
	"negative_float_override" boolean DEFAULT false,
	"large_durations_override" boolean DEFAULT false,
	"invalid_tasks_override" boolean DEFAULT false,
	"resources_assigned_override" boolean DEFAULT false,
	"late_tasks_override" boolean DEFAULT false,
	"critical_path_test_override" boolean DEFAULT false,
	"critical_path_length_override" boolean DEFAULT false,
	"baseline_execution_index_override" boolean DEFAULT false,
	"overall_score" integer,
	"passed" boolean,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "nec_compliance" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"assessment_date" timestamp DEFAULT now() NOT NULL,
	"programme_defined" boolean,
	"accepted_programme" boolean,
	"regular_updates" boolean,
	"early_warnings_managed" boolean,
	"compensation_events_tracked" boolean,
	"key_dates_identified" boolean,
	"completion_date_realistic" boolean,
	"resources_adequate" boolean,
	"overall_compliant" boolean,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer,
	"name" text NOT NULL,
	"description" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"status_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"nec_compliant" boolean,
	"project_manager" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"ms_project_id" text,
	"name" text NOT NULL,
	"wbs_code" text,
	"duration" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"percent_complete" numeric(5, 2) DEFAULT '0',
	"predecessors" text[],
	"resources" text[],
	"is_critical_path" boolean DEFAULT false,
	"total_float" integer,
	"is_milestone" boolean DEFAULT false,
	"is_summary" boolean DEFAULT false,
	"constraint_type" text
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#3B82F6',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dcma_assessments" ADD CONSTRAINT "dcma_assessments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nec_compliance" ADD CONSTRAINT "nec_compliance_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;