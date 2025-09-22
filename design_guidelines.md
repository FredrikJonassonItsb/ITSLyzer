# Design Guidelines: Swedish ITSL Requirements Analysis Tool

## Design Approach
**System-Based Approach** using Material Design principles adapted for enterprise productivity. This utility-focused application prioritizes efficiency, data clarity, and workflow optimization over visual aesthetics.

## Core Design Elements

### Color Palette
**Primary Colors:**
- Light mode: 220 25% 25% (deep blue-gray)
- Dark mode: 220 20% 85% (light blue-gray)

**Background Colors:**
- Light mode: 0 0% 98% (near white)
- Dark mode: 220 15% 8% (dark blue-black)

**Accent Colors:**
- Success: 142 76% 36% (green for "OK" status)
- Warning: 38 92% 50% (orange for "Under utveckling")
- Info: 217 91% 60% (blue for highlights)

### Typography
**Fonts:** Inter via Google Fonts CDN
- Headers: Inter 600 (semibold)
- Body: Inter 400 (regular)
- Data/Code: Inter 500 (medium)

**Scale:**
- H1: text-3xl (30px)
- H2: text-2xl (24px)
- H3: text-xl (20px)
- Body: text-base (16px)
- Small: text-sm (14px)

### Layout System
**Spacing Units:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4, p-6
- Section margins: m-6, m-8
- Element spacing: gap-4, space-y-6

**Grid Structure:**
- Main layout: 12-column CSS Grid
- Sidebar: 280px fixed width
- Content area: flexible with max-width constraints

### Component Library

**Navigation:**
- Fixed sidebar with collapsible sections
- Breadcrumb navigation for deep workflows
- Tab-based section switching

**Data Display:**
- Sortable/filterable tables with sticky headers
- Status badges with color coding
- Progress indicators for AI analysis
- Card-based requirement displays

**Forms & Input:**
- File upload with drag-and-drop styling
- Multi-select dropdowns for filters
- Search bars with autocomplete
- Toggle switches for view options

**Feedback:**
- Toast notifications for system feedback
- Loading spinners for AI operations
- Empty states with actionable guidance

## Key Design Principles

1. **Information Density:** Maximize visible data while maintaining readability
2. **Workflow Efficiency:** Minimize clicks between common tasks
3. **Status Clarity:** Clear visual indicators for requirement states
4. **Accessibility:** High contrast ratios, keyboard navigation support
5. **Swedish Localization:** All UI text in Swedish, proper handling of åäö characters

## Critical UX Patterns

- **File Import Flow:** Prominent upload area → parsing feedback → results preview
- **Requirements Table:** Infinite scroll with virtual rendering for performance
- **AI Grouping Interface:** Side-by-side comparison with drag-and-drop organization
- **Filter Panel:** Collapsible left panel with category hierarchies
- **Export Functions:** One-click export buttons with format options

This design prioritizes functionality and efficiency over visual flair, creating a professional tool that Swedish procurement professionals can use effectively for complex requirement analysis workflows.