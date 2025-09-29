import { storage } from "./storage";

/**
 * Service for mapping and standardizing category names
 * Uses database mappings first, then AI fallback for unknown categories
 */
export class CategoryMappingService {
  private mappingCache: Map<string, string> | null = null;

  /**
   * Load all mappings into memory cache for fast lookup
   */
  private async loadMappingsCache(): Promise<void> {
    if (this.mappingCache === null) {
      const mappings = await storage.getAllCategoryMappings();
      this.mappingCache = new Map(
        mappings.map(m => [m.source_category, m.target_category])
      );
      console.log(`📋 Loaded ${mappings.length} category mappings into cache`);
    }
  }

  /**
   * Invalidate cache (call when mappings are updated)
   */
  public invalidateCache(): void {
    this.mappingCache = null;
  }

  /**
   * Map a source category to its standardized target category
   * Priority: 1) Database mapping, 2) AI matching, 3) Create new
   */
  async mapCategory(sourceCategory: string | null | undefined): Promise<string> {
    // Handle null/undefined/empty categories
    if (!sourceCategory || sourceCategory.trim() === '') {
      return 'Okategoriserad';
    }

    const trimmed = sourceCategory.trim();

    // Load cache if not already loaded
    await this.loadMappingsCache();

    // 1. Check exact match in cache
    if (this.mappingCache!.has(trimmed)) {
      const target = this.mappingCache!.get(trimmed)!;
      console.log(`✅ Category mapping found: "${trimmed}" → "${target}"`);
      return target;
    }

    // 2. Check case-insensitive match
    const lowerSource = trimmed.toLowerCase();
    for (const [source, target] of Array.from(this.mappingCache!.entries())) {
      if (source.toLowerCase() === lowerSource) {
        console.log(`✅ Case-insensitive match: "${trimmed}" → "${target}"`);
        // Add exact match to database for future lookups
        await this.createMapping(trimmed, target);
        return target;
      }
    }

    // 3. Try AI-based matching with existing target categories
    console.log(`🤖 No exact match for "${trimmed}", trying AI matching...`);
    const uniqueTargets = Array.from(new Set(this.mappingCache!.values()));
    
    if (uniqueTargets.length > 0) {
      try {
        const aiMatch = await this.findAIMatch(trimmed, uniqueTargets);
        if (aiMatch) {
          console.log(`✅ AI match found: "${trimmed}" → "${aiMatch}"`);
          await this.createMapping(trimmed, aiMatch);
          return aiMatch;
        }
      } catch (error) {
        console.warn(`⚠️ AI matching failed for "${trimmed}":`, error);
      }
    }

    // 4. Create new category mapping (use cleaned source as target)
    console.log(`➕ Creating new category: "${trimmed}"`);
    const cleanTarget = this.cleanCategoryName(trimmed);
    await this.createMapping(trimmed, cleanTarget);
    return cleanTarget;
  }

  /**
   * Call AI for category matching
   */
  private async callAIForCategoryMatch(prompt: string): Promise<{ match: boolean; targetCategory: string | null; confidence: number }> {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: "Du är expert på svensk IT-upphandling. Svara alltid med giltigt JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content || '{"match": false, "targetCategory": null, "confidence": 0}');
  }

  /**
   * Use AI to find the best matching category from existing targets
   */
  private async findAIMatch(sourceCategory: string, targetCategories: string[]): Promise<string | null> {
    const prompt = `Du är expert på svensk IT-upphandling och kategorisering av krav.

Källkategori: "${sourceCategory}"

Befintliga standardkategorier:
${targetCategories.map((cat, idx) => `${idx + 1}. ${cat}`).join('\n')}

Avgör om källkategorin matchar någon befintlig standardkategori med minst 70% likhet.

Svara med JSON:
{
  "match": true/false,
  "targetCategory": "kategorinamn om match finns, annars null",
  "confidence": 0-100
}`;

    try {
      const response = await this.callAIForCategoryMatch(prompt);
      
      if (response.match && response.confidence >= 70 && response.targetCategory) {
        return response.targetCategory;
      }
      
      return null;
    } catch (error) {
      console.error('Error in AI category matching:', error);
      return null;
    }
  }

  /**
   * Clean category name by removing leading letters/numbers and extra whitespace
   */
  private cleanCategoryName(category: string): string {
    // Remove leading single letters or numbers with dots (e.g., "A. ", "B.1 ", "C.2 ")
    let cleaned = category.replace(/^[A-Z]\d?\.\s*/i, '');
    
    // Remove leading single letters without dots (e.g., "A ", "F ")
    cleaned = cleaned.replace(/^[A-Z]\s+/i, '');
    
    // Trim and normalize whitespace
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    
    return cleaned || category;
  }

  /**
   * Create a new category mapping and update cache
   */
  private async createMapping(sourceCategory: string, targetCategory: string): Promise<void> {
    try {
      await storage.createCategoryMapping({
        source_category: sourceCategory,
        target_category: targetCategory
      });
      
      // Update cache
      if (this.mappingCache) {
        this.mappingCache.set(sourceCategory, targetCategory);
      }
      
      console.log(`✅ Created new mapping: "${sourceCategory}" → "${targetCategory}"`);
    } catch (error) {
      // Ignore duplicate key errors (might occur in concurrent operations)
      if (!(error as any)?.message?.includes('duplicate key')) {
        console.error('Error creating category mapping:', error);
      }
    }
  }

  /**
   * Batch map multiple categories efficiently
   */
  async mapCategories(sourceCategories: (string | null | undefined)[]): Promise<Map<string, string>> {
    await this.loadMappingsCache();
    
    const results = new Map<string, string>();
    
    // Handle null/empty by mapping to 'Okategoriserad' explicitly
    results.set('', 'Okategoriserad');
    
    for (const source of sourceCategories) {
      const normalized = source?.trim() || '';
      
      // Skip empty string as it's already mapped
      if (!normalized) {
        continue;
      }
      
      if (!results.has(normalized)) {
        const target = await this.mapCategory(normalized);
        results.set(normalized, target);
      }
    }
    
    return results;
  }
}

export const categoryMappingService = new CategoryMappingService();
