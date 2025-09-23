import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Requirements table schema according to ITSL specification
export const requirements = pgTable("requirements", {
  id: varchar("id").primaryKey(),
  text: text("text").notNull(),
  occurrences: integer("occurrences").notNull().default(0),
  organizations: json("organizations").$type<string[]>().notNull().default([]),
  must_count: integer("must_count").notNull().default(0),
  should_count: integer("should_count").notNull().default(0),
  fulfilled_yes: integer("fulfilled_yes").notNull().default(0),
  fulfilled_no: integer("fulfilled_no").notNull().default(0),
  attachment_required: boolean("attachment_required").notNull().default(false),
  req_ids: json("req_ids").$type<string[]>().notNull().default([]),
  categories: json("categories").$type<string[]>().notNull().default([]),
  procurements: json("procurements").$type<string[]>().notNull().default([]),
  dates: json("dates").$type<string[]>().notNull().default([]),
  sample_comment: text("sample_comment").default(""),
  sample_response: text("sample_response").default(""),
  user_comment: text("user_comment").default(""),
  
  // Extended fields for enhanced functionality
  user_status: varchar("user_status").default("OK"), // OK, Under development, Later, etc.
  group_id: varchar("group_id"), // For intelligent grouping of requirements
  group_representative: boolean("group_representative").default(false),
  similarity_score: integer("similarity_score").default(0),
  historical_comments: json("historical_comments").$type<string[]>().notNull().default([]),
  last_seen_date: text("last_seen_date"),
  first_seen_date: text("first_seen_date"),
  is_new: boolean("is_new").default(true),
  category_label: text("category_label"),
  
  // Import handling
  import_organization: text("import_organization").notNull(), // Organization for imported file (mandatory)
  import_date: text("import_date"),                           // Import date
  requirement_type: text("requirement_type"),                 // "Skall" eller "Bör"
  requirement_category: text("requirement_category")          // Category from Excel headers
});

export type Requirement = typeof requirements.$inferSelect;
export type InsertRequirement = typeof requirements.$inferInsert;

export const insertRequirementSchema = createInsertSchema(requirements);

// Schema for filtering options
export const filterSchema = z.object({
  searchQuery: z.string().optional(),
  requirementTypes: z.array(z.enum(["Skall", "Bör", "all"])).optional(),
  organizations: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  dates: z.array(z.string()).optional(),
  userStatus: z.array(z.enum(["OK", "Under utveckling", "Senare", "Granskas", "Godkänd", "Avvisad", "Behöver förtydligande", "all"])).optional(),
  showOnlyNew: z.boolean().optional(),
  showGrouped: z.boolean().optional(),
});

export type FilterOptions = z.infer<typeof filterSchema>;

// Schema for statistics
export const statisticsSchema = z.object({
  totalRequirements: z.number(),
  mustRequirements: z.number(),
  shouldRequirements: z.number(),
  organizations: z.number(),
  groups: z.number(),
  newRequirements: z.number(),
  categories: z.array(z.object({
    name: z.string(),
    count: z.number(),
  })),
  organizationStats: z.array(z.object({
    name: z.string(),
    count: z.number(),
  })),
  statusStats: z.array(z.object({
    status: z.string(),
    count: z.number(),
  })),
});

export type Statistics = z.infer<typeof statisticsSchema>;

// Comparison result schema
export const comparisonResultSchema = z.object({
  requirement: z.object({
    id: z.string(),
    text: z.string(),
    requirement_type: z.string().nullable(),
    requirement_category: z.string().nullable(),
  }),
  occurrenceCount: z.number(),
  historicalResponse: z.string().optional(),
  currentStatus: z.string().optional(),
  isNew: z.boolean(),
  similarityScore: z.number().optional(),
});

export type ComparisonResult = z.infer<typeof comparisonResultSchema>;

// Requirement group schema for AI grouping
export const requirementGroupSchema = z.object({
  groupId: z.string(),
  representativeId: z.string(),
  members: z.array(z.string()),
  similarityScore: z.number(),
  category: z.string().optional(),
});

export type RequirementGroup = z.infer<typeof requirementGroupSchema>;

// Export filter and upload schemas for forms
export const uploadExcelSchema = z.object({
  organization: z.string().min(1, "Organisation måste anges"),
  description: z.string().optional(),
});
