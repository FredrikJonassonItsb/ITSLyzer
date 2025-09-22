import { type Requirement, type InsertRequirement, type FilterOptions, type Statistics } from "@shared/schema";
import { db } from "./db";
import { requirements } from "@shared/schema";
import { eq, like, and, inArray, sql, count, or, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Requirements CRUD
  getRequirement(id: string): Promise<Requirement | undefined>;
  getAllRequirements(filters?: FilterOptions): Promise<Requirement[]>;
  createRequirement(requirement: InsertRequirement): Promise<Requirement>;
  updateRequirement(id: string, updates: Partial<Requirement>): Promise<Requirement | undefined>;
  deleteRequirement(id: string): Promise<boolean>;
  
  // Bulk operations
  createManyRequirements(requirements: InsertRequirement[]): Promise<Requirement[]>;
  
  // Statistics
  getStatistics(): Promise<Statistics>;
  
  // AI Grouping support
  getRequirementsForGrouping(): Promise<Requirement[]>;
  updateRequirementGroup(id: string, groupId: string, isRepresentative: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getRequirement(id: string): Promise<Requirement | undefined> {
    const [requirement] = await db.select().from(requirements).where(eq(requirements.id, id));
    return requirement || undefined;
  }

  async getAllRequirements(filters?: FilterOptions): Promise<Requirement[]> {
    let query = db.select().from(requirements);
    
    if (filters) {
      const conditions = [];
      
      if (filters.searchQuery) {
        conditions.push(like(requirements.text, `%${filters.searchQuery}%`));
      }
      
      if (filters.requirementTypes && filters.requirementTypes.length > 0 && !filters.requirementTypes.includes('all')) {
        conditions.push(inArray(requirements.requirement_type, filters.requirementTypes.filter(type => type !== 'all')));
      }
      
      if (filters.organizations && filters.organizations.length > 0) {
        // Handle JSONB array search for organizations (Postgres compatible)
        const orgConditions = filters.organizations.map(org => 
          sql`${requirements.organizations}::jsonb @> ${JSON.stringify([org])}::jsonb`
        );
        conditions.push(or(...orgConditions));
      }
      
      if (filters.categories && filters.categories.length > 0) {
        // Handle JSONB array search for categories
        const categoryConditions = filters.categories.map(category => 
          sql`${requirements.categories}::jsonb @> ${JSON.stringify([category])}::jsonb`
        );
        conditions.push(or(...categoryConditions));
      }
      
      if (filters.dates && filters.dates.length > 0) {
        // Handle JSONB array search for dates
        const dateConditions = filters.dates.map(date => 
          sql`${requirements.dates}::jsonb @> ${JSON.stringify([date])}::jsonb`
        );
        conditions.push(or(...dateConditions));
      }
      
      if (filters.showGrouped) {
        conditions.push(isNotNull(requirements.group_id));
      }
      
      if (filters.userStatus && filters.userStatus.length > 0 && !filters.userStatus.includes('all')) {
        conditions.push(inArray(requirements.user_status, filters.userStatus.filter(status => status !== 'all')));
      }
      
      if (filters.showOnlyNew) {
        conditions.push(eq(requirements.is_new, true));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
    }
    
    return await query;
  }

  async createRequirement(requirement: InsertRequirement): Promise<Requirement> {
    const id = requirement.id || randomUUID();
    const [created] = await db
      .insert(requirements)
      .values({ ...requirement, id })
      .returning();
    return created;
  }

  async updateRequirement(id: string, updates: Partial<Requirement>): Promise<Requirement | undefined> {
    const [updated] = await db
      .update(requirements)
      .set(updates)
      .where(eq(requirements.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRequirement(id: string): Promise<boolean> {
    const result = await db
      .delete(requirements)
      .where(eq(requirements.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createManyRequirements(reqs: InsertRequirement[]): Promise<Requirement[]> {
    const reqsWithIds = reqs.map(req => ({
      ...req,
      id: req.id || randomUUID(),
    }));
    
    return await db
      .insert(requirements)
      .values(reqsWithIds)
      .returning();
  }

  async getStatistics(): Promise<Statistics> {
    // Get basic counts
    const [totalCount] = await db.select({ count: count() }).from(requirements);
    const [mustCount] = await db.select({ count: count() }).from(requirements)
      .where(eq(requirements.requirement_type, 'Skall'));
    const [shouldCount] = await db.select({ count: count() }).from(requirements)
      .where(eq(requirements.requirement_type, 'Bör'));
    const [newCount] = await db.select({ count: count() }).from(requirements)
      .where(eq(requirements.is_new, true));

    // Get category statistics using JSONB unnesting
    const categoryStats = await db.execute(sql`
      SELECT category AS name, COUNT(*) as count
      FROM requirements, jsonb_array_elements_text(categories::jsonb) AS category
      WHERE categories IS NOT NULL AND jsonb_array_length(categories::jsonb) > 0
      GROUP BY category
      ORDER BY count DESC
    `);

    // Get organization statistics
    const organizationStats = await db.execute(sql`
      SELECT org AS name, COUNT(*) as count  
      FROM requirements, jsonb_array_elements_text(organizations::jsonb) AS org
      WHERE organizations IS NOT NULL AND jsonb_array_length(organizations::jsonb) > 0
      GROUP BY org
      ORDER BY count DESC
    `);

    // Get status statistics
    const statusStats = await db.execute(sql`
      SELECT user_status AS status, COUNT(*) as count
      FROM requirements 
      WHERE user_status IS NOT NULL
      GROUP BY user_status
      ORDER BY count DESC
    `);

    // Get unique organizations and groups count
    const allReqs = await db.select({ 
      organizations: requirements.organizations,
      group_id: requirements.group_id 
    }).from(requirements);
    
    const uniqueOrgs = new Set<string>();
    const uniqueGroups = new Set<string>();
    
    allReqs.forEach(req => {
      if (req.organizations && Array.isArray(req.organizations)) {
        req.organizations.forEach(org => uniqueOrgs.add(org));
      }
      if (req.group_id) {
        uniqueGroups.add(req.group_id);
      }
    });

    return {
      totalRequirements: totalCount.count,
      mustRequirements: mustCount.count,
      shouldRequirements: shouldCount.count,
      organizations: uniqueOrgs.size,
      groups: uniqueGroups.size,
      newRequirements: newCount.count,
      categories: (categoryStats.rows || []).map((row: any) => ({
        name: row.name,
        count: parseInt(row.count)
      })),
      organizationStats: (organizationStats.rows || []).map((row: any) => ({
        name: row.name,
        count: parseInt(row.count)
      })),
      statusStats: (statusStats.rows || []).map((row: any) => ({
        status: row.status,
        count: parseInt(row.count)
      })),
    };
  }

  async getRequirementsForGrouping(): Promise<Requirement[]> {
    return await db.select().from(requirements);
  }

  async updateRequirementGroup(id: string, groupId: string, isRepresentative: boolean, similarityScore?: number, category?: string): Promise<void> {
    await db
      .update(requirements)
      .set({ 
        group_id: groupId, 
        group_representative: isRepresentative,
        similarity_score: similarityScore || null,
        category_label: category || null
      })
      .where(eq(requirements.id, id));
  }

  async clearAllGroupings(): Promise<void> {
    await db
      .update(requirements)
      .set({ 
        group_id: null,
        group_representative: false,
        similarity_score: null,
        category_label: null
      });
  }

  async clearRequirementGrouping(id: string): Promise<void> {
    await db
      .update(requirements)
      .set({ 
        group_id: null,
        group_representative: false,
        similarity_score: null,
        category_label: null
      })
      .where(eq(requirements.id, id));
  }
}

export const storage = new DatabaseStorage();
