# Microsoft Project Programme Analyzer

A professional web application for construction project managers and planners to upload, analyze, and assess Microsoft Project schedules against industry standards.

## Features

- **File Upload & Parsing**: Support for MS Project files (.mpp, .xml, .xlsx, .csv)
- **DCMA 14-Point Assessment**: Automated schedule quality compliance analysis
- **NEC Compliance Checking**: Contract compliance assessment
- **Project Management**: Track multiple projects and programmes
- **Detailed Reporting**: Task-level breakdowns with specific findings

## Technology Stack

- **Frontend**: React 18 with TypeScript, Vite, Wouter routing, TanStack Query
- **Backend**: Express.js with TypeScript
- **UI Components**: Shadcn/ui on Radix UI primitives
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Drizzle ORM
- **File Processing**: MPXJ (Python), xml2js, xlsx

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+ (for .mpp file parsing)
- PostgreSQL database (optional - uses in-memory storage by default)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/ms-project-analyzer.git
cd ms-project-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Install Python dependencies (for .mpp file support):
```bash
pip install mpxj jpype1
```

### Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Usage

1. **Upload a Project File**: Navigate to the upload page and select your MS Project file (.mpp, .xml, .xlsx, or .csv)
2. **View DCMA Assessment**: Automatically generated 14-point compliance analysis
3. **View NEC Compliance**: Contract compliance assessment results
4. **Review Task Details**: Drill down into specific task failures with MS Project ID references

## DCMA 14-Point Assessment

The system automatically evaluates projects against these criteria:

1. Logic (Predecessors/Successors)
2. Leads & Lags (≤5% threshold)
3. Hard Constraints (≤5% threshold)
4. Negative Lags (zero tolerance)
5. High Float (threshold-based)
6. Negative Float
7. Resources Assigned
8. High Duration
9. Critical Path Validity
10. Missing Tasks

## NEC Compliance Checks

- Schedule Quality Assessment
- Programme Acceptance
- Update Requirements
- Risk Management
- Key Dates Tracking
- Completion Date Realism
- Resource Adequacy

## License

MIT

## Author

Built with Replit Agent
