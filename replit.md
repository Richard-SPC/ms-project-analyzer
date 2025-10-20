# Construction Contract Analyzer

## Overview

A professional web application designed for construction and legal professionals to extract and analyze key information from construction contract PDFs. The system uses AI-powered extraction to identify critical dates, access terms, and damages clauses with confidence scoring, enabling quick contract review and analysis.

**Core Functionality:**
- PDF contract upload and text extraction
- AI-powered data extraction using OpenAI GPT-5
- Structured presentation of key contract terms (dates, access details, damages)
- Natural language query interface for contract questions
- Data export capabilities (JSON/CSV)

**Target Users:** Construction managers, legal professionals, and contract administrators who need to quickly extract and verify specific information from construction contracts.

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
- File upload handling via multer middleware (10MB PDF limit)
- JSON response format with error handling middleware
- Request/response logging for API endpoints only

**PDF Processing Pipeline:**
1. Client uploads PDF via multipart/form-data
2. Server validates file type (PDF only) and size
3. pdf-parse library extracts raw text from PDF
4. Text sent to OpenAI for structured data extraction
5. Validated data stored in database
6. Response returned to client with contract ID

**AI Integration:**
- OpenAI GPT-5 API for contract data extraction
- Structured JSON output with confidence scores (0-100)
- Fixed schema for three categories: keyDates, accessDetails, damages
- Each category contains 4 labeled fields with value and confidence
- Text truncated to 12,000 characters for API cost/performance balance

### Data Storage

**Database Strategy:**
- Drizzle ORM for type-safe database operations
- PostgreSQL as primary database (configured for Neon serverless)
- Schema-first approach with Zod validation

**Schema Design:**

*Contracts Table:*
- UUID primary key (auto-generated)
- File metadata (name, size)
- Upload timestamp
- Full extracted text (stored for query capability)
- Extracted data as JSONB (structured AI output)

*Queries Table:*
- UUID primary key
- Foreign key to contracts
- Question/answer pairs
- Optional source citation
- Creation timestamp

**Storage Abstraction:**
- IStorage interface for potential database swapping
- MemStorage implementation for in-memory development/testing
- Designed to be replaced with Drizzle-based PostgreSQL implementation

**Data Flow:**
- Insert schemas enforce validation before database writes
- Type inference from schema for compile-time safety
- JSONB storage allows flexible querying of extracted data structure

### External Dependencies

**AI Services:**
- OpenAI API (GPT-5 model)
- Used for contract data extraction and question answering
- Requires OPENAI_API_KEY environment variable

**Database:**
- Neon Serverless PostgreSQL
- Requires DATABASE_URL environment variable
- Connection via @neondatabase/serverless driver

**Third-Party Libraries:**

*Core Dependencies:*
- React ecosystem: react, react-dom, wouter, @tanstack/react-query
- UI components: @radix-ui/* (accordion, dialog, dropdown, etc.)
- Forms: react-hook-form with @hookform/resolvers
- Validation: zod, drizzle-zod
- Styling: tailwindcss, clsx, tailwind-merge, class-variance-authority
- Date handling: date-fns
- PDF parsing: pdf-parse

*Development Tools:*
- TypeScript for type safety
- Vite plugins for Replit integration (@replit/vite-plugin-*)
- drizzle-kit for database migrations
- esbuild for production server bundling

**Environment Configuration:**
- NODE_ENV for environment detection
- DATABASE_URL for PostgreSQL connection
- OPENAI_API_KEY for AI features
- All sensitive config via environment variables

**Build & Deployment:**
- Development: Concurrent Vite dev server + tsx for backend
- Production: Static frontend build + bundled Node.js server
- Database migrations via drizzle-kit push command
- Client assets served from dist/public in production