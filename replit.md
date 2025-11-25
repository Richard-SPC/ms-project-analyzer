# Microsoft Project Programme Analyzer

## Overview

A professional web application for construction project managers and planners to upload, analyze, and assess Microsoft Project schedules against industry standards. The system provides automated DCMA 14-point compliance assessment and NEC contract compliance checking with detailed findings and metrics.

**Core Functionality:**
- Microsoft Project file upload (.mpp/.xml/.xlsx/.csv) and parsing
- Automated DCMA 14-point schedule quality assessment
- NEC contract compliance checking
- Manual override system for DCMA assessments with justification tracking
- Project and task management
- Multi-project/programme tracking
- Detailed compliance reports

**Target Users:** Construction project managers, planners, schedulers, and contract administrators.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:** React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for server state.

**UI Component Strategy:** Shadcn/ui on Radix UI primitives, Tailwind CSS with custom design system, professional utility design, optimized color palette for light/dark modes, Inter font.

**State Management:** React Query for server state, React hooks for local state, Context API for theme with localStorage persistence.

**Key Design Decisions:** Single-page application, optimistic UI updates, responsive design (mobile breakpoint at 768px), accessibility-first.

### Backend Architecture

**Server Framework:** Express.js with TypeScript, ESM module system, tsx for hot-reload, esbuild for production bundling.

**API Design:** RESTful endpoints under `/api`, Multer for file uploads (50MB limit), JSON response format, error handling, request/response logging.

**Project File Processing Pipeline:**
1. Client uploads .mpp, .xml, .xlsx, or .csv file.
2. Server validates file type and size.
3. File parser extracts project metadata and task structure:
   - XML files: `xml2js` library. TotalSlack converted from tenths-of-minutes to days (÷4800).
   - MPP files: MPXJ Python library (via Python subprocess).
   - Excel/CSV files: `xlsx` library with intelligent column detection.
4. Data stored in in-memory storage (MemStorage).
5. Response returned to client with project ID.

**DCMA Analysis Engine:** Automated compliance analysis against 14 DCMA criteria using real project data, including logic completeness (with milestones), leads & lags (≤5%), hard constraints (MSO/MFO/SNLT/FNLT only, ≤5%), negative lags (zero tolerance), high float, resource assignments, high duration, critical path validation, and missed tasks. All checks include milestones in analysis and filter out summary tasks. Provides detailed task-level breakdowns showing which specific tasks failed each criterion with reasons.

**NEC Analysis Engine:** Automated compliance analysis against 8 NEC contract criteria, checking schedule quality, programme acceptance, updates, risk management, key dates, completion date realism, and resource adequacy. Filters out summary tasks.

### Data Storage

**Database Strategy:** Drizzle ORM for type-safe operations, PostgreSQL (configured for Neon serverless), schema-first approach with Zod validation.

**Schema Design:**
- **Workspaces Table:** Stores "Project" containers (called workspaces in schema) with name, description, and color for organization.
- **Projects Table:** Stores "Programme" data (called projects in schema) with metadata, NEC compliance status, and optional workspaceId for project association.
- **Tasks Table:** Stores task details including dependencies, resources, critical path, total float, constraint types. Includes `isSummary` flag, `constraintType` (ASAP, ALAP, MSO, MFO, SNET, SNLT, FNET, FNLT), and `msProjectId` (original MS Project task ID for cross-reference).
- **DCMA Assessments Table:** Stores assessment results for each programme, including criterion-specific results, overall score, and manual override flags (14 boolean fields allowing users to override failed checks with justification).
- **NEC Compliance Table:** Stores assessment results for each programme, including criterion-specific results and overall status.

**Terminology Note:** The UI uses "Project" to refer to containers/categories (stored in `workspaces` table) and "Programme" to refer to individual schedules (stored in `projects` table). This terminology aligns with construction industry conventions.

**Storage Abstraction:** IStorage interface with MemStorage for development, designed for Drizzle-based PostgreSQL implementation.

## External Dependencies

**Database:**
- PostgreSQL (via `@neondatabase/serverless` driver)
- Neon Serverless PostgreSQL (optional for production)

**Third-Party Libraries:**
- **React Ecosystem:** `react`, `react-dom`, `wouter`, `@tanstack/react-query`
- **UI Components:** `@radix-ui/*`, `shadcn/ui`
- **Forms & Validation:** `react-hook-form`, `@hookform/resolvers`, `zod`, `drizzle-zod`
- **Styling:** `tailwindcss`, `clsx`, `tailwind-merge`, `class-variance-authority`
- **Date Handling:** `date-fns`
- **XML Parsing:** `xml2js`
- **MPP Parsing:** MPXJ Python library (`mpxj`, `jpype1`) via Python subprocess (requires Python 3.11 and OpenJDK 21)
- **Excel/CSV Parsing:** `xlsx` library with flexible column detection
- **File Upload:** `multer`
- **Development Tools:** `typescript`, `@replit/vite-plugin-*`, `drizzle-kit`, `esbuild`

**Environment Configuration:** `NODE_ENV`, `DATABASE_URL`, sensitive configurations via environment variables.