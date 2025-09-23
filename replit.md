# Replit.md - Svenska ITSL Kravanalysverktyg

## Overview

This is a Swedish requirements analysis tool (Kravanalysverktyg) developed for ITSL Solutions AB. The application is designed to import, analyze, filter, and manage procurement requirements from Excel files. It features AI-powered requirement grouping using language models to identify similar requirements across different procurement documents, making it easier to track common requirements across multiple organizations and tenders.

The system provides three main views: Import (for uploading new Excel files with AI-based comparison), Requirements compilation (aggregated requirement lists with configurable category ordering), and Comparison (loading new requirement files to compare against the existing database showing requirement frequency across procurements).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript in Single Page Application (SPA) architecture
- **Build System**: Vite for development server and build tooling with hot module replacement
- **Styling**: Tailwind CSS with shadcn/ui component library following Material Design principles
- **State Management**: TanStack Query (React Query) for server state management, caching, and data synchronization
- **Routing**: Wouter for lightweight client-side routing using React Hooks
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **UI Components**: Comprehensive component library using Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js web server
- **Language**: TypeScript for full type safety across the stack
- **Database Access**: Drizzle ORM for type-safe database operations with PostgreSQL
- **File Processing**: Multer middleware for file uploads and XLSX (SheetJS) for Excel file parsing
- **API Design**: RESTful API with proper error handling and request logging middleware

### Database Design
- **Primary Storage**: PostgreSQL database with JSON fields for flexible requirement metadata
- **Schema Features**: 
  - Requirements table with text analysis fields (occurrences, categories, organizations)
  - Support for requirement types (must/should requirements)
  - AI grouping fields (group_id, group_representative, similarity_score)
  - User interaction tracking (comments, status, historical data)
  - Import metadata (organization, dates, procurement tracking)

### AI Integration
- **Service**: OpenAI integration using GPT-5 for requirement analysis and grouping
- **Functionality**: Automated similarity detection between requirements across different Excel imports
- **Batching**: Smart batch processing to handle large requirement sets while respecting API limits
- **Consolidation**: Cross-batch group consolidation for comprehensive requirement matching

### Design System
- **Theme**: Material Design principles optimized for enterprise productivity
- **Typography**: Inter font family via Google Fonts CDN with structured type scale
- **Colors**: Professional blue-gray palette with comprehensive light/dark mode support
- **Layout**: Responsive grid system with fixed sidebar (280px) and flexible main content area
- **Spacing**: Consistent Tailwind spacing units (2, 4, 6, 8) throughout the application

## External Dependencies

### Core Infrastructure
- **Database**: PostgreSQL via Neon serverless platform (@neondatabase/serverless)
- **File Storage**: Multer for multipart/form-data handling and temporary file storage
- **Session Management**: PostgreSQL session store (connect-pg-simple)

### AI and Analysis
- **OpenAI API**: GPT-5 integration for requirement text analysis and similarity detection
- **Natural Language Processing**: Swedish language support for requirement categorization

### Third-party Services
- **Font Service**: Google Fonts CDN for Inter typography
- **Development Tools**: Replit development environment with specialized plugins
- **Build Optimization**: esbuild for production bundling and deployment

### File Processing
- **Excel Support**: XLSX library (SheetJS) for reading/writing spreadsheet formats
- **Date Handling**: date-fns library for Swedish locale date formatting and manipulation
- **Validation**: Zod schemas for runtime type checking and API validation

### UI and Interaction
- **Component Primitives**: Radix UI headless components for accessibility compliance
- **Icons**: Lucide React icon library for consistent visual language
- **Animations**: Tailwind CSS animations with custom hover/active states
- **Command Interface**: cmdk for searchable command palette functionality