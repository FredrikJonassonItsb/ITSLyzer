import { type Requirement, type InsertRequirement, type FilterOptions, type Statistics, type PaginationOptions, type LeanRequirement, type PaginatedRequirements } from "@shared/schema";
import { db } from "./db";
import { requirements } from "@shared/schema";
import { eq, like, and, inArray, sql, count, or, isNotNull, desc, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

// Simple in-memory cache for statistics
interface CacheEntry {
  data: Statistics;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): Statistics | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: Statistics, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const statisticsCache = new SimpleCache();

export interface IStorage {
  // Requirements CRUD
  getRequirement(id: string): Promise<Requirement | undefined>;
  getAllRequirements(filters?: FilterOptions): Promise<Requirement[]>;
  getAllRequirementsPaginated(filters?: FilterOptions, pagination?: PaginationOptions): Promise<PaginatedRequirements>;
  createRequirement(requirement: InsertRequirement): Promise<Requirement>;
  updateRequirement(id: string, updates: Partial<Requirement>): Promise<Requirement | undefined>;
  deleteRequirement(id: string): Promise<boolean>;
  deleteAllRequirements(): Promise<boolean>;
  
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
        const filteredTypes = filters.requirementTypes.filter(type => type !== 'all');
        conditions.push(inArray(requirements.requirement_type, filteredTypes));
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
      
      // Handle sheet category filtering (first category level)
      if (filters.sheetCategory && filters.sheetCategory !== 'all') {
        conditions.push(sql`${requirements.categories}::jsonb->0 = ${filters.sheetCategory}::text`);
      }
      
      // Handle section category filtering (second category level)
      if (filters.sectionCategory && filters.sectionCategory !== 'all') {
        conditions.push(sql`${requirements.categories}::jsonb->1 = ${filters.sectionCategory}::text`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
    }
    
    return await query;
  }

  async getAllRequirementsPaginated(filters?: FilterOptions, pagination?: PaginationOptions): Promise<PaginatedRequirements> {
    const { page = 1, limit = 20, sortBy = "import_date", sortOrder = "desc" } = pagination || {};
    const offset = (page - 1) * limit;

    // Build base query with lean field selection for performance
    let query = db.select({
      id: requirements.id,
      text: requirements.text,
      requirement_type: requirements.requirement_type,
      requirement_category: requirements.requirement_category,
      user_status: requirements.user_status,
      user_comment: requirements.user_comment,
      group_id: requirements.group_id,
      group_representative: requirements.group_representative,
      similarity_score: requirements.similarity_score,
      categories: requirements.categories,
      organizations: requirements.organizations,
      occurrences: requirements.occurrences,
      import_organization: requirements.import_organization,
      import_date: requirements.import_date,
      is_new: requirements.is_new,
    }).from(requirements);

    // Apply same filters as getAllRequirements
    if (filters) {
      const conditions = [];
      
      if (filters.searchQuery) {
        conditions.push(like(requirements.text, `%${filters.searchQuery}%`));
      }
      
      if (filters.requirementTypes && filters.requirementTypes.length > 0 && !filters.requirementTypes.includes('all')) {
        conditions.push(inArray(requirements.requirement_type, filters.requirementTypes.filter(type => type !== 'all')));
      }
      
      if (filters.organizations && filters.organizations.length > 0) {
        const orgConditions = filters.organizations.map(org => 
          sql`${requirements.organizations}::jsonb @> ${JSON.stringify([org])}::jsonb`
        );
        conditions.push(or(...orgConditions));
      }
      
      if (filters.categories && filters.categories.length > 0) {
        const categoryConditions = filters.categories.map(category => 
          sql`${requirements.categories}::jsonb @> ${JSON.stringify([category])}::jsonb`
        );
        conditions.push(or(...categoryConditions));
      }
      
      if (filters.dates && filters.dates.length > 0) {
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
      
      // Handle sheet category filtering (first category level)
      if (filters.sheetCategory && filters.sheetCategory !== 'all') {
        conditions.push(sql`${requirements.categories}::jsonb->0 = ${filters.sheetCategory}::text`);
      }
      
      // Handle section category filtering (second category level)
      if (filters.sectionCategory && filters.sectionCategory !== 'all') {
        conditions.push(sql`${requirements.categories}::jsonb->1 = ${filters.sectionCategory}::text`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
    }

    // Apply sorting with explicit column mapping
    const sortColumnMap = {
      import_date: requirements.import_date,
      text: requirements.text,
      requirement_type: requirements.requirement_type,
      user_status: requirements.user_status,
    };
    const sortColumn = sortColumnMap[sortBy];
    if (sortColumn) {
      query = query.orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn)) as typeof query;
    }

    // Apply pagination
    query = query.limit(limit).offset(offset) as typeof query;

    // Execute paginated query
    const data = await query;

    // Get total count for pagination metadata
    let countQuery = db.select({ count: count() }).from(requirements);
    if (filters) {
      const conditions = [];
      
      if (filters.searchQuery) {
        conditions.push(like(requirements.text, `%${filters.searchQuery}%`));
      }
      
      if (filters.requirementTypes && filters.requirementTypes.length > 0 && !filters.requirementTypes.includes('all')) {
        conditions.push(inArray(requirements.requirement_type, filters.requirementTypes.filter(type => type !== 'all')));
      }
      
      if (filters.organizations && filters.organizations.length > 0) {
        const orgConditions = filters.organizations.map(org => 
          sql`${requirements.organizations}::jsonb @> ${JSON.stringify([org])}::jsonb`
        );
        conditions.push(or(...orgConditions));
      }
      
      if (filters.categories && filters.categories.length > 0) {
        const categoryConditions = filters.categories.map(category => 
          sql`${requirements.categories}::jsonb @> ${JSON.stringify([category])}::jsonb`
        );
        conditions.push(or(...categoryConditions));
      }
      
      if (filters.dates && filters.dates.length > 0) {
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
        countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      }
    }

    const [{ count: total }] = await countQuery;
    const totalPages = Math.ceil(total / limit);

    return {
      requirements: data as LeanRequirement[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  async createRequirement(requirement: InsertRequirement): Promise<Requirement> {
    const id = requirement.id || randomUUID();
    const [created] = await db
      .insert(requirements)
      .values({ ...requirement, id })
      .returning();
    
    // Invalidate statistics cache
    statisticsCache.invalidate('statistics');
    
    return created;
  }

  async updateRequirement(id: string, updates: Partial<Requirement>): Promise<Requirement | undefined> {
    const [updated] = await db
      .update(requirements)
      .set(updates)
      .where(eq(requirements.id, id))
      .returning();
    
    // Invalidate statistics cache on any update
    statisticsCache.invalidate('statistics');
    
    return updated || undefined;
  }

  async deleteRequirement(id: string): Promise<boolean> {
    const result = await db
      .delete(requirements)
      .where(eq(requirements.id, id));
    
    // Invalidate statistics cache
    statisticsCache.invalidate('statistics');
    
    return (result.rowCount || 0) > 0;
  }

  async deleteAllRequirements(): Promise<boolean> {
    const result = await db.delete(requirements);
    
    // Invalidate statistics cache
    statisticsCache.invalidate('statistics');
    
    return (result.rowCount || 0) > 0;
  }

  async createManyRequirements(reqs: InsertRequirement[]): Promise<Requirement[]> {
    const reqsWithIds = reqs.map(req => ({
      ...req,
      id: req.id || randomUUID(),
    }));
    
    const result = await db
      .insert(requirements)
      .values(reqsWithIds)
      .returning();
    
    // Invalidate statistics cache after bulk insert
    statisticsCache.invalidate('statistics');
    
    return result;
  }

  async getStatistics(): Promise<Statistics> {
    const cacheKey = 'statistics';
    
    // Try to get from cache first
    const cached = statisticsCache.get(cacheKey);
    if (cached) {
      console.log('📊 Statistics served from cache');
      return cached;
    }

    console.log('📊 Computing statistics (cache miss)...');
    const startTime = Date.now();

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

    // Get unique organizations count using SQL aggregates (optimized)
    const uniqueOrgsResult = await db.execute(sql`
      SELECT COUNT(DISTINCT org) as count
      FROM requirements, jsonb_array_elements_text(organizations::jsonb) AS org
      WHERE organizations IS NOT NULL AND jsonb_array_length(organizations::jsonb) > 0
    `);
    
    // Get unique groups count using SQL aggregate (optimized)
    const uniqueGroupsResult = await db.execute(sql`
      SELECT COUNT(DISTINCT group_id) as count
      FROM requirements 
      WHERE group_id IS NOT NULL
    `);

    const uniqueOrgsCount = parseInt((uniqueOrgsResult.rows?.[0] as any)?.count || '0');
    const uniqueGroupsCount = parseInt((uniqueGroupsResult.rows?.[0] as any)?.count || '0');

    const result = {
      totalRequirements: totalCount.count,
      mustRequirements: mustCount.count,
      shouldRequirements: shouldCount.count,
      organizations: uniqueOrgsCount,
      groups: uniqueGroupsCount,
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

    const computeTime = Date.now() - startTime;
    console.log(`📊 Statistics computed in ${computeTime}ms, caching for 60s`);
    
    // Cache for 60 seconds
    statisticsCache.set(cacheKey, result, 60000);
    
    return result;
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
    
    // Invalidate statistics cache after grouping update
    statisticsCache.invalidate('statistics');
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
    
    // Invalidate statistics cache after clearing all groupings
    statisticsCache.invalidate('statistics');
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
    
    // Invalidate statistics cache after clearing requirement grouping
    statisticsCache.invalidate('statistics');
  }
}

export const storage = new DatabaseStorage();
