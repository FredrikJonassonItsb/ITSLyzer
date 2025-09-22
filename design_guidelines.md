# Design Guidelines: Svenska ITSL Kravanalysverktyg

## Design Approach
**System-Based Approach** using Material Design principles optimized for enterprise productivity. This utility-focused application prioritizes data clarity, workflow efficiency, and professional usability for Swedish public sector procurement specialists.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Light mode: 220 25% 25% (deep blue-gray)
- Dark mode: 220 20% 85% (light blue-gray)

**Background Colors:**
- Light mode: 0 0% 98% (near white)
- Dark mode: 220 15% 8% (dark blue-black)

**Surface Colors:**
- Light mode cards: 0 0% 100% (pure white)
- Dark mode cards: 220 12% 12% (dark blue-gray)

**Status Colors:**
- Success: 142 76% 36% (approved requirements)
- Warning: 38 92% 50% (under review)
- Error: 0 84% 60% (rejected/invalid)
- Info: 217 91% 60% (informational highlights)

### Typography
**Primary Font:** Inter via Google Fonts CDN
- Headers: Inter 600 (semibold) 
- Body text: Inter 400 (regular)
- Data labels: Inter 500 (medium)
- Code/IDs: Inter 400 (regular, monospace styling)

**Type Scale:**
- H1: text-3xl (page titles)
- H2: text-2xl (section headers)
- H3: text-xl (subsection headers)
- Body: text-base (primary content)
- Caption: text-sm (metadata, labels)

### Layout System
**Spacing Units:** Tailwind units of 2, 4, 6, and 8
- Component internal spacing: p-4, p-6
- Section separation: gap-6, space-y-8
- Page margins: px-6, py-8

**Grid Structure:**
- Sidebar: 280px fixed width with collapsible states
- Main content: flexible width with max-w-7xl constraint
- Data tables: full-width within content area

### Component Library

**Navigation & Structure:**
- Fixed sidebar navigation with expandable requirement categories
- Breadcrumb trails for complex workflows
- Tab navigation for multi-view data analysis
- Floating action buttons for primary actions (import, export)

**Data Display:**
- Sortable data tables with sticky headers and virtual scrolling
- Requirement cards with status indicators and metadata
- Progress bars for analysis completion status
- Statistical dashboards with charts and KPIs
- Empty states with actionable guidance

**Input & Controls:**
- File upload zones with drag-and-drop styling
- Multi-select filters with Swedish category labels
- Search fields with autocomplete for requirement matching
- Toggle switches for view preferences
- Dropdown menus with proper åäö character support

**Feedback Systems:**
- Toast notifications for system status
- Loading indicators for AI processing
- Status badges with clear Swedish terminology
- Confirmation dialogs for destructive actions

## Key Design Principles

1. **Data Clarity:** Maximize information density while maintaining Swedish readability
2. **Workflow Efficiency:** Streamlined paths for common procurement tasks
3. **Status Transparency:** Clear visual hierarchy for requirement states
4. **Swedish Localization:** Native Swedish UI with proper character encoding
5. **Professional Aesthetics:** Clean, government-appropriate design language

## Critical UX Patterns

**File Import Workflow:** Prominent upload area → parsing progress → validation results
**Requirements Management:** Filter panel + sortable table + detailed requirement cards
**AI Analysis Interface:** Side-by-side comparison views with grouping controls
**Export Functions:** Quick-access export buttons with Swedish format options
**Search & Discovery:** Global search with category-specific filtering

This design creates a professional, efficient tool specifically tailored for Swedish procurement professionals, emphasizing data clarity and workflow optimization within government standards.