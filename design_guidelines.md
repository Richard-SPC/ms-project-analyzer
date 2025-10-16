# Design Guidelines: Construction Contract Analyzer

## Design Approach: Professional Utility System
**Selected Approach:** Hybrid Design System (Linear + Carbon Design influences)
- Linear's modern, professional aesthetic for UI polish
- Carbon Design's data-display patterns for structured information
- Emphasis on clarity, efficiency, and trustworthiness for construction/legal professionals

**Core Principle:** Prioritize information hierarchy and workflow efficiency over decorative elements. Every design decision serves the goal of quick, accurate contract analysis.

---

## Color Palette

### Light Mode
- **Background:** 0 0% 100% (pure white)
- **Surface:** 210 20% 98% (very light cool gray)
- **Border:** 214 15% 88% (subtle borders)
- **Primary Brand:** 215 80% 50% (professional blue - trust/reliability)
- **Success/Extracted:** 142 76% 36% (green for confirmed data)
- **Warning:** 45 93% 47% (amber for incomplete/missing data)
- **Text Primary:** 222 47% 11% (near black)
- **Text Secondary:** 215 15% 45% (muted gray)

### Dark Mode
- **Background:** 222 47% 11% (deep charcoal)
- **Surface:** 217 33% 17% (elevated surface)
- **Border:** 217 20% 25% (subtle borders)
- **Primary Brand:** 215 85% 60% (lighter blue for dark mode)
- **Success/Extracted:** 142 71% 45% (adjusted green)
- **Warning:** 45 90% 55% (adjusted amber)
- **Text Primary:** 210 20% 98% (near white)
- **Text Secondary:** 215 15% 70% (muted light gray)

---

## Typography

**Font Stack:** 'Inter', system-ui, -apple-system, sans-serif (professional, highly legible)

### Hierarchy
- **Page Titles:** 32px, font-weight 700, tracking -0.02em
- **Section Headers:** 24px, font-weight 600, tracking -0.01em
- **Subsection Headers:** 18px, font-weight 600
- **Body Text:** 15px, font-weight 400, line-height 1.6 (optimal for contract reading)
- **Data Labels:** 13px, font-weight 500, uppercase, tracking 0.05em, text-secondary
- **Data Values:** 15px, font-weight 500, text-primary
- **Helper Text:** 13px, font-weight 400, text-secondary

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Section spacing: gap-8 to gap-12
- Page margins: px-6 md:px-12 lg:px-16
- Card spacing: p-6
- Form fields: gap-4

**Container Strategy:**
- Max width: max-w-7xl for main content
- Two-column data display: grid-cols-1 lg:grid-cols-2
- Three-column extracted data: grid-cols-1 md:grid-cols-2 xl:grid-cols-3

---

## Component Library

### Upload Zone
- Large dropzone: min-h-64, dashed border-2, rounded-lg
- Center-aligned icon (document/upload), heading, and helper text
- Hover state: subtle background color shift, border becomes solid
- Active drag state: primary brand color background at 5% opacity

### File Preview Card
- Compact horizontal layout: file icon + filename + size + remove button
- Subtle background, rounded corners, border
- Success state after processing: green border-l-4 indicator

### Extracted Data Display
- Card-based sections for each data category (Key Dates, Access Details, Damages)
- Label-value pairs in a clean grid layout
- Empty states: dashed outline with "No data extracted" message
- Confidence indicators: small badge showing AI confidence percentage

### Query Interface
- Prominent search/question input field at top
- Recent queries history below input
- Query results: highlighted text + extracted answer + source location reference

### Data Table (for complex extracts)
- Alternating row backgrounds for readability
- Sticky header on scroll
- Sort indicators on column headers
- Export button (JSON/CSV) in table toolbar

### Navigation
- Clean top navigation bar: logo left, key actions (New Analysis, History) right
- Minimal sidebar for contract history/saved analyses (collapsible on mobile)

### Buttons
- Primary: filled with brand color, medium rounded corners
- Secondary: outlined with brand color
- Danger/Delete: outlined red, only for destructive actions
- Ghost: minimal background, for tertiary actions

---

## Interactions & Animations

**Minimal Motion Philosophy:** Animations only for feedback and state changes

- Page transitions: 200ms fade
- Loading states: subtle pulse on skeleton screens
- Data appearing: 150ms ease-in from opacity 0
- Hover states: 100ms transition for all interactive elements
- No decorative animations or scroll effects

---

## Key User Flows

### 1. Upload Flow
Clean, focused upload interface → File preview confirmation → Processing loader (with progress if possible) → Results display

### 2. Results Display
Tab-based or sectioned layout:
- Overview tab: All key data at a glance
- Detailed tab: Full contract text with highlighted extractions
- Query tab: Ask questions interface
- Export tab: Download options

### 3. Data Presentation Hierarchy
Most critical: Key dates (large, prominent cards)
Secondary: Access details and damages (organized sections)
Tertiary: Full contract view (available but not primary focus)

---

## Images

**Hero Section:** NO large hero image
- This is a utility app; users come with a task in mind
- Lead with upload functionality immediately
- Small brand icon/logo sufficient for visual identity

**Supporting Graphics:**
- Empty state illustrations: Simple, professional line-art style for "No contracts uploaded yet"
- Processing state: Minimal animated icon showing document analysis
- Success confirmations: Checkmark icons, no complex illustrations

---

## Professional Trust Signals

- Subtle: "AI-Powered Analysis" badge near extracted data
- Security indicator: "Your contracts are processed securely" text near upload
- Data accuracy: Confidence scores displayed with extracted information
- Version tracking: Show which contract version was analyzed

---

## Responsive Considerations

**Mobile (< 768px):**
- Stack all columns to single column
- Collapsible sections for extracted data
- Bottom sheet for query interface
- Simplified table view (key columns only)

**Desktop (> 1024px):**
- Two-panel layout: contract preview | extracted data
- Multi-column data grids
- Persistent navigation and toolbars