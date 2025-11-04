# Microsoft Project Programme Analyzer

## Overview

A professional web application for construction project managers and planners to upload, analyze, and assess Microsoft Project schedules against industry standards. The system provides automated DCMA 14-point compliance assessment and NEC contract compliance checking with detailed findings and metrics.

**Core Functionality:**
- Microsoft Project file upload (.mpp/.xml) and parsing
- Automated DCMA 14-point schedule quality assessment with real data analysis
- NEC contract compliance checking
- Project and task management with relationship tracking
- Manual project data entry with task dependencies
- Multi-project/programme tracking
- Detailed compliance reports with specific findings and percentages

**Target Users:** Construction project managers, planners, schedulers, and contract administrators who need to assess schedule quality and compliance against DCMA and NEC standards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management

**UI Component Strategy:**
- Shadcn/ui components built on Radix UI primitives for accessibility
- Tailwind CSS for styling with custom design system variables
- Design approach: Hybrid of Linear and Carbon Design influences emphasizing professional utility over decoration
- Custom color palette optimized for light/dark modes with professional blue primary brand color
- Inter font family for optimal contract readability

**State Management:**
- React Query for server state with disabled refetching (staleTime: Infinity)
- Local component state using React hooks
- Theme state managed via Context API with localStorage persistence

**Key Design Decisions:**
- Single-page application with minimal routing (primarily home page)
- Optimistic UI updates for better perceived performance
- Responsive design with mobile breakpoint at 768px
- Accessibility-first component architecture via Radix UI

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- ESM module system (type: "module")
- Development hot-reload via tsx
- Production build using esbuild for server bundling

**API Design:**
- RESTful endpoints under `/api` prefix
- File upload handling via multer middleware (50MB limit for .mpp/.xml files)
- JSON response format with error handling middleware
- Request/response logging for API endpoints only

**Project File Processing Pipeline:**
1. Client uploads .mpp or .xml file via multipart/form-data
2. Server validates file type and size
3. File parser extracts project metadata and task structure:
   - **XML files**: Parsed using xml2js library
   - **MPP files**: Parsed using MPXJ Python library (via Python subprocess)
4. Tasks with predecessors, durations, dates, resources are created
5. Summary tasks are automatically detected and marked with `isSummary` flag
6. Data stored in in-memory storage (MemStorage)
7. Response returned to client with project ID

**DCMA Analysis Engine:**
- Automated compliance analysis against 14 DCMA criteria
- Analyzes real project and task data (not manual checkboxes)
- Key criteria implemented:
  - Logic completeness: validates predecessors/successors, identifies disconnected tasks
  - High float detection: flags tasks with >44 days total float
  - Resource assignments: checks ≥95% of tasks have resources
  - High duration: identifies tasks >44 days
  - Critical path validation
  - Missed tasks: identifies past-due incomplete tasks
- Returns detailed findings with counts, percentages, and specific metrics
- Each criterion provides pass/fail with explanatory details

### Data Storage

**Database Strategy:**
- Drizzle ORM for type-safe database operations
- PostgreSQL as primary database (configured for Neon serverless)
- Schema-first approach with Zod validation

**Schema Design:**

*Projects Table:*
- Serial ID primary key
- Project name and description
- Start and end dates
- Status (active, completed, on-hold)
- NEC compliance status
- Project manager
- Creation timestamp

*Tasks Table:*
- Serial ID primary key
- Foreign key to projects
- Task name and WBS code
- Duration, start/end dates
- Percent complete
- Predecessors array (task dependencies)
- Resources array
- Critical path flag
- Total float (in days)
- Milestone flag

*DCMA Assessments Table:*
- Serial ID primary key
- Foreign key to projects
- Assessment date
- 14 boolean fields for DCMA criteria results
- Overall score (0-14)
- Pass/fail status
- Notes

*NEC Compliance Table:*
- Serial ID primary key
- Foreign key to projects
- Assessment date
- 8 boolean fields for NEC compliance criteria
- Overall compliance status
- Notes

**Storage Abstraction:**
- IStorage interface for potential database swapping
- MemStorage implementation for in-memory development/testing
- Designed to be replaced with Drizzle-based PostgreSQL implementation

**Data Flow:**
- Insert schemas enforce validation before database writes
- Type inference from schema for compile-time safety
- JSONB storage allows flexible querying of extracted data structure

### External Dependencies

**Database:**
- PostgreSQL (configured for in-memory storage in development)
- Neon Serverless PostgreSQL for production (optional)
- Connection via @neondatabase/serverless driver

**Third-Party Libraries:**

*Core Dependencies:*
- React ecosystem: react, react-dom, wouter, @tanstack/react-query
- UI components: @radix-ui/* (accordion, dialog, dropdown, etc.)
- Forms: react-hook-form with @hookform/resolvers
- Validation: zod, drizzle-zod
- Styling: tailwindcss, clsx, tailwind-merge, class-variance-authority
- Date handling: date-fns
- XML parsing: xml2js (for Microsoft Project XML files)
- MPP parsing: MPXJ Python library (mpxj, jpype1) via subprocess
- File upload: multer (for .mpp/.xml file handling)

*Development Tools:*
- TypeScript for type safety
- Vite plugins for Replit integration (@replit/vite-plugin-*)
- drizzle-kit for database migrations
- esbuild for production server bundling

**Environment Configuration:**
- NODE_ENV for environment detection
- DATABASE_URL for PostgreSQL connection (optional)
- All sensitive config via environment variables

**Build & Deployment:**
- Development: Concurrent Vite dev server + tsx for backend
- Production: Static frontend build + bundled Node.js server
- Database migrations via drizzle-kit push command (when using PostgreSQL)
- Client assets served from dist/public in production

## Recent Changes

### November 4, 2025 - Full MPP File Support

**Feature: Native Microsoft Project Binary File Parsing**
- Added full .mpp file parsing using MPXJ open-source library
- Installed Python 3.11 and MPXJ Python wrapper (mpxj, jpype1 packages)
- Created Python parser script (`server/parseMpp.py`) that extracts project and task data
- Updated `mppParser.ts` to call Python script via subprocess and parse JSON results
- Updated upload route to create projects and tasks directly from .mpp files

**Technical Implementation:**
- MPXJ library provides comprehensive support for MS Project binary formats (MPP 98-2019)
- Python script uses `UniversalProjectReader` to auto-detect file format
- Extracts: project metadata, tasks, resources, predecessors, dates, durations, critical path, float
- Summary tasks are automatically detected and marked with `isSummary` flag
- Node.js backend spawns Python process, passes temp file path, receives JSON response
- Same data model as XML parsing for consistency

**User Experience:**
- Upload .mpp files directly without conversion
- Automatic parsing and project creation with all tasks
- Full compliance analysis (DCMA & NEC) available immediately after upload
- No external API dependencies - fully self-contained

**Dependencies Added:**
- Python 3.11 runtime
- mpxj (Python package, version 14.5.2)
- jpype1 (Java-Python bridge, version 1.6.0)

### November 4, 2025 - Summary Task Filtering

**Feature: Summary Task Exclusion from Analysis**
- Added `isSummary` boolean field to tasks schema to track Microsoft Project summary tasks
- Updated XML parser to detect and mark summary tasks from uploaded files
- Modified DCMA analyzer to filter out summary tasks before analysis
- Modified NEC analyzer to filter out summary tasks before analysis
- All compliance metrics and percentages now calculated based on work tasks only

**Technical Details:**
- Summary tasks are filtered at the start of each analyzer function: `workTasks = tasks.filter(t => !t.isSummary)`
- All task counts, percentages, and thresholds reference work tasks only
- Helpful error message when all tasks are summary tasks
- Both DCMA and NEC analyzers use consistent filtering approach

**Rationale:**
Summary tasks in Microsoft Project are organizational groupings that roll up subtask data. They should not be analyzed for compliance as they:
- Don't represent actual work
- Have calculated dates/durations from subtasks
- Can artificially inflate or deflate compliance metrics

### October 30, 2025 - Automated NEC Compliance Analysis Implementation

**Major Feature: Automated NEC Compliance Analysis**
- Transformed NEC Compliance from manual checkbox system to fully automated analysis
- Created `necAnalyzer.ts` service that analyzes real project task data against 8 NEC contract compliance criteria
- Automated analysis examines schedule quality, programme acceptance, updates, risk management, and resource adequacy

**NEC Criteria Implemented:**
1. Programme Defined - checks project dates and task date coverage (≥90%)
2. Accepted Programme - validates comprehensive baseline coverage (≥90% tasks with dates)
3. Regular Updates - verifies progress tracking on tasks (≥80%)
4. Early Warnings Managed - checks for high float and missed tasks (≤15%)
5. Compensation Events Tracked - validates contingency planning (moderate float ≥5%)
6. Key Dates Identified - ensures milestone tasks exist
7. Completion Date Realistic - validates critical path alignment (≤30 days variance)
8. Resources Adequate - checks resource assignments (≥80%)

**API Enhancements:**
- Added GET `/api/projects/:projectId/nec-analysis` endpoint for automated NEC analysis
- Returns detailed findings with counts, percentages, and explanatory text for each criterion
- Overall compliance status based on all 8 criteria passing

**UI Improvements:**
- Removed manual NEC checkboxes from compliance creation
- Added "Run Analysis" button for each project
- Display detailed findings in accordion-based results dialog
- Show specific metrics (e.g., "5 of 8 tasks (62.5%) have progress tracking")
- Maintain assessment history with detailed criterion-by-criterion results

**Technical Details:**
- Analysis engine returns structured findings object similar to DCMA analyzer
- Each criterion provides pass/fail status with detailed explanatory text
- Overall compliant only if all 8 criteria pass
- Assessments can be saved with optional notes for future reference

### October 29, 2025 - Automated DCMA Analysis Implementation

**Major Feature: Automated DCMA Compliance Analysis**
- Transformed DCMA Assessment from manual checkbox system to fully automated analysis
- Created `dcmaAnalyzer.ts` service that analyzes real project task data against all 14 DCMA criteria
- Implemented sophisticated logic completeness check that:
  - Builds successor map by scanning predecessor relationships
  - Identifies legitimate boundary tasks (start tasks with no predecessors, end tasks with no successors)
  - Excludes boundary tasks from violation count
  - Detects disconnected tasks (no predecessors AND no successors)
  - Calculates percentage based on internal tasks only
  - Passes if ≤5% of internal tasks have incomplete logic

**API Enhancements:**
- Added GET `/api/projects/:projectId/dcma-analysis` endpoint for automated analysis
- Added POST `/api/projects/:projectId/tasks` endpoint for creating tasks under specific projects
- Enhanced date handling in schemas to accept ISO date strings and convert to Date objects

**DCMA Criteria Implemented:**
1. Logic completeness - validates task connections, identifies disconnected tasks
2. Lead/lag validation - placeholder (data not in current schema)
3. Hard constraints - placeholder (data not in current schema)
4. Negative lags - placeholder (data not in current schema)
5. High duration - identifies tasks >44 days
6. Invalid dates - validates date ranges
7. Resource assignments - checks ≥95% of tasks have resources
8. Missed tasks - identifies past-due incomplete tasks
9. High float - flags tasks with >44 days total float
10. Critical path test - validates critical path exists
11. Critical path length - checks project timeline alignment
12. Baseline exists - verifies baseline dates
13. SVI/BV validation - placeholder (requires earned value data)
14. BCWS validation - placeholder (requires earned value data)

**UI Improvements:**
- Removed manual DCMA checkboxes from assessment creation
- Added "Run Analysis" button for each project
- Display detailed findings with specific metrics (e.g., "5 of 150 tasks (3.3%) have excessive float")
- Show breakdown of start tasks, end tasks, and internal task violations
- Maintain assessment history with detailed criterion-by-criterion results

**Technical Details:**
- Analysis engine returns structured findings object with counts, percentages, and pass/fail status
- Criteria that pass the threshold show detailed success metrics
- Criteria that fail show specific violation counts and affected task numbers
- Overall score calculated as sum of passed criteria (0-14)
- Assessment passes if score ≥10 (configurable threshold)