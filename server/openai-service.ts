import OpenAI from "openai";
import type { Requirement, RequirementGroup } from "@shared/schema";
import { categoryMappingService } from "./category-mapping-service";

// Using reliable OpenAI model for Swedish requirement analysis
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GroupingResult {
  groups: RequirementGroup[];
  ungroupedRequirements: string[];
}

export class OpenAIService {
  private generateUniqueGroupId(): string {
    return `grupp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Group similar requirements using AI analysis with retry and consolidation
   * Groups requirements per category with high sensitivity for similarity
   */
  async groupRequirements(requirements: Requirement[], progressCallback?: (message: string, type?: string, step?: number, total?: number) => void): Promise<GroupingResult> {
    if (!requirements.length) {
      return { groups: [], ungroupedRequirements: [] };
    }

    // First group requirements by category with standardization
    const categoryGroups = new Map<string, Requirement[]>();
    
    // Batch map all unique categories upfront for efficiency
    const uniqueCategories = Array.from(new Set(requirements.map(req => req.requirement_category)));
    const categoryMapping = await categoryMappingService.mapCategories(uniqueCategories);
    
    requirements.forEach(req => {
      const rawCategory = req.requirement_category || 'Okategoriserad';
      const mappedCategory = categoryMapping.get(rawCategory) || rawCategory;
      
      if (!categoryGroups.has(mappedCategory)) {
        categoryGroups.set(mappedCategory, []);
      }
      categoryGroups.get(mappedCategory)!.push(req);
    });

    const allGroups: RequirementGroup[] = [];
    const ungroupedRequirements: string[] = [];

    progressCallback?.(`📊 Identifierat ${categoryGroups.size} kategorier att analysera`, 'info');

    let processedCategories = 0;
    const totalCategories = categoryGroups.size;

    // Process each category separately with high sensitivity
    for (const [category, categoryRequirements] of Array.from(categoryGroups.entries())) {
      console.log(`🏷️ Processing category: ${category} (${categoryRequirements.length} requirements)`);
      progressCallback?.(`🏷️ Analyserar kategori: ${category} (${categoryRequirements.length} krav)`, 'progress', processedCategories + 1, totalCategories);

      // Skip categories with less than 2 requirements (can't group)
      if (categoryRequirements.length < 2) {
        ungroupedRequirements.push(...categoryRequirements.map(req => req.id));
        progressCallback?.(`⏭️ Hoppar över kategori "${category}" - för få krav för gruppering`, 'info');
        processedCategories++;
        continue;
      }

      // Perform a single AI call per category with retry handling
      const categoryResult = await this.groupCategoryWithRetry(category, categoryRequirements, progressCallback);

      categoryResult.groups.forEach(group => {
        group.groupId = this.generateUniqueGroupId();
        group.category = category; // Ensure category is preserved
      });

      allGroups.push(...categoryResult.groups);
      ungroupedRequirements.push(...categoryResult.ungroupedRequirements);

      processedCategories++;
    }

    console.log(`🎯 AI grouping completed: ${allGroups.length} groups across ${categoryGroups.size} categories`);
    progressCallback?.(`🎯 Gruppering slutförd: ${allGroups.length} grupper skapade`, 'success');
    return { groups: allGroups, ungroupedRequirements };
  }

  private async groupCategoryWithRetry(
    category: string,
    requirements: Requirement[],
    progressCallback?: (message: string, type?: string, step?: number, total?: number) => void,
    maxRetries: number = 2
  ): Promise<GroupingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting AI grouping (attempt ${attempt}/${maxRetries}) for category "${category}" with ${requirements.length} requirements...`);
        if (attempt > 1) {
          progressCallback?.(`🔄 Försök ${attempt}/${maxRetries} för AI-gruppering av kategori "${category}"...`, 'retry');
        }
        progressCallback?.(`📡 Skickar ${requirements.length} krav i ett OpenAI-anrop för kategori "${category}"`, 'info');
        return await this.groupRequirementsForCategory(category, requirements);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`AI grouping attempt ${attempt} for category "${category}" failed:`, lastError.message);
        progressCallback?.(`⚠️ Försök ${attempt} misslyckades för kategori "${category}": ${lastError.message}`, 'warning');

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying category "${category}" in ${delay}ms...`);
          progressCallback?.(`⏱️ Väntar ${delay}ms innan nytt försök för kategori "${category}"...`, 'info');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`All ${maxRetries} attempts failed for category "${category}", falling back to ungrouped:`, lastError?.message);
    progressCallback?.(`❌ Alla ${maxRetries} försök misslyckades för kategori "${category}", lämnar krav ogrouperade`, 'error');
    
    // Fallback: return all requirements as ungrouped
    return {
      groups: [],
      ungroupedRequirements: requirements.map(req => req.id)
    };
  }

  /**
   * Consolidate groups from multiple batches by finding similar categories
   */
  private async consolidateGroups(
    groups: RequirementGroup[], 
    ungroupedRequirements: string[], 
    allRequirements: Requirement[]
  ): Promise<GroupingResult> {
    try {
      // Group by category to find potential merges
      const categoryGroups = new Map<string, RequirementGroup[]>();
      
      groups.forEach(group => {
        const category = group.category || 'Okategoriserad';
        if (!categoryGroups.has(category)) {
          categoryGroups.set(category, []);
        }
        categoryGroups.get(category)!.push(group);
      });

      const consolidatedGroups: RequirementGroup[] = [];
      
      // For each category with multiple groups, try to merge similar ones
      for (const [category, categoryGroupList] of Array.from(categoryGroups.entries())) {
        if (categoryGroupList.length === 1) {
          consolidatedGroups.push(categoryGroupList[0]);
        } else {
          // Merge groups in the same category
          const mergedGroup: RequirementGroup = {
            groupId: this.generateUniqueGroupId(),
            representativeId: categoryGroupList[0].representativeId,
            members: categoryGroupList.flatMap((g: RequirementGroup) => g.members),
            similarityScore: Math.round(
              categoryGroupList.reduce((sum: number, g: RequirementGroup) => sum + g.similarityScore, 0) / categoryGroupList.length
            ),
            category: category
          };
          consolidatedGroups.push(mergedGroup);
        }
      }

      return { groups: consolidatedGroups, ungroupedRequirements };

    } catch (error) {
      console.error("Error consolidating groups:", error);
      // Return original groups if consolidation fails
      return { groups, ungroupedRequirements };
    }
  }

  private async groupRequirementsForCategory(category: string, requirements: Requirement[]): Promise<GroupingResult> {
    try {
      const knownRequirementIds = new Set(requirements.map(req => req.id));

      const payload = {
        category,
        instructions: {
          similarityThreshold: 0.8,
          minimumGroupSize: 2,
          strictCategoryMatching: true,
          coverageRequired: true,
        },
        requirements: requirements.map(req => ({
          id: req.id,
          text: req.text,
          type: req.requirement_type,
          category: req.requirement_category,
        })),
      };

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150000); // 150 second timeout to allow full category coverage

      let response;
      try {
        response = await openai.responses.create({
          model: "gpt-5-nano",
          input: [
            {
              role: "system",
              content: [
                {
                  type: "text",
                  text: "Du är en expert på svensk IT-upphandling och kravanalys. Du analyserar tekniska krav och grupperar dem intelligent baserat på funktionalitet och teknikområde. Svara alltid med giltigt JSON som uppfyller angivet schema.",
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analysera samtliga krav i kategorin "${category}". Varje krav måste antingen placeras i en grupp eller återfinnas i listan över ogrouperade krav.`,
                },
                {
                  type: "input_json",
                  json: payload,
                },
              ],
            },
          ],
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "grouping_response",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  groups: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["representativeId", "members", "similarityScore", "category"],
                      properties: {
                        groupId: { type: "string" },
                        representativeId: { type: "string" },
                        members: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 2,
                        },
                        similarityScore: {
                          type: "number",
                          minimum: 0,
                          maximum: 100,
                        },
                        category: { type: "string" },
                      },
                    },
                  },
                  ungroupedRequirements: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["groups", "ungroupedRequirements"],
              },
            },
          },
        }, { signal: controller.signal, timeout: 150000 });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as any).name === "AbortError") {
          throw new Error("OpenAI API call timed out efter 150 sekunder");
        }
        throw error;
      }

      const result = this.extractJsonPayload(response) ?? {};
      const assignedIds = new Set<string>();
      const duplicateIds = new Set<string>();

      const groups: RequirementGroup[] = (Array.isArray(result.groups) ? result.groups : [])
        .filter((group: any) =>
          group &&
          group.representativeId &&
          Array.isArray(group.members) &&
          group.members.length >= 2
        )
        .map((group: any) => {
          const candidateMembers: string[] = [
            ...group.members.filter((id: string) => knownRequirementIds.has(id)),
            group.representativeId,
          ];

          const uniqueMembers: string[] = [];
          for (const memberId of candidateMembers) {
            if (!knownRequirementIds.has(memberId)) {
              continue;
            }
            if (assignedIds.has(memberId)) {
              duplicateIds.add(memberId);
              continue;
            }
            assignedIds.add(memberId);
            if (!uniqueMembers.includes(memberId)) {
              uniqueMembers.push(memberId);
            }
          }

          if (uniqueMembers.length < 2) {
            // Not enough members left after sanitisation; drop the group entirely.
            uniqueMembers.forEach(id => assignedIds.delete(id));
            return null;
          }

          const representativeId = knownRequirementIds.has(group.representativeId) && uniqueMembers.includes(group.representativeId)
            ? group.representativeId
            : uniqueMembers[0];

          const similarityScoreRaw = typeof group.similarityScore === "number" ? group.similarityScore : 0;
          const similarityScore = similarityScoreRaw <= 1 ? Math.round(Math.max(0, Math.min(1, similarityScoreRaw)) * 100) : Math.round(Math.max(0, Math.min(100, similarityScoreRaw)));

          return {
            groupId: group.groupId ?? this.generateUniqueGroupId(),
            representativeId,
            members: uniqueMembers,
            similarityScore,
            category,
          } satisfies RequirementGroup;
        })
        .filter((group): group is RequirementGroup => Boolean(group));

      const ungroupedSet = new Set<string>(
        (Array.isArray(result.ungroupedRequirements) ? result.ungroupedRequirements : [])
          .filter((id: string) => knownRequirementIds.has(id))
      );

      duplicateIds.forEach(id => ungroupedSet.add(id));

      const missingIds = requirements
        .map(req => req.id)
        .filter(id => !assignedIds.has(id) && !ungroupedSet.has(id));

      missingIds.forEach(id => ungroupedSet.add(id));

      return { groups, ungroupedRequirements: Array.from(ungroupedSet) };

    } catch (error) {
      console.error("Error in AI grouping:", error as Error);

      // Fallback: return all requirements as ungrouped
      return {
        groups: [],
        ungroupedRequirements: requirements.map(req => req.id),
      };
    }
  }

  /**
   * Analyze and categorize a single requirement
   */
  async categorizeRequirement(requirementText: string): Promise<string> {
    try {
      const prompt = `Analysera följande IT-krav och föreslå en lämplig kategori på svenska:

Krav: "${requirementText}"

Vanliga kategorier inom IT-upphandling:
- Säkerhet och autentisering
- Integration och API
- Backup och återställning
- GDPR och dataskydd
- Prestanda och skalbarhet
- Användargränssnitt
- Rapportering och analys
- Systemadministration
- Databas och lagring
- Nätverk och infrastruktur

Svara endast med kategorins namn (max 3 ord).`;

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response;
      try {
        response = await openai.chat.completions.create({
          model: "gpt-5-nano",
          messages: [
            {
              role: "system",
              content: "Du kategoriserar IT-krav på svenska. Svara endast med kategorins namn."
            },
            {
              role: "user",
              content: prompt
            }
          ],
        }, { signal: controller.signal, timeout: 30000 });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as any).name === 'AbortError') {
          throw new Error('OpenAI API call timed out after 30 seconds');
        }
        throw error;
      }

      return response.choices[0].message.content?.trim() || 'Okategoriserad';

    } catch (error) {
      console.error("Error categorizing requirement:", error as Error);
      return 'Okategoriserad';
    }
  }

  /**
   * Generate a summary of requirement groups for reporting
   */
  async generateGroupingSummary(groups: RequirementGroup[], totalRequirements: number): Promise<string> {
    try {
      const prompt = `Skapa en kort sammanfattning av kravgruppering på svenska:

Totalt antal krav: ${totalRequirements}
Antal grupper: ${groups.length}
Antal grupperade krav: ${groups.reduce((sum, g) => sum + g.members.length, 0)}

Grupper:
${groups.map(g => `- ${g.category}: ${g.members.length} krav (likhetspoäng: ${g.similarityScore}%)`).join('\n')}

Skapa en sammanfattning på 2-3 meningar om grupperingsresultatet och dess nytta för kravanalysen.`;

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response;
      try {
        response = await openai.chat.completions.create({
          model: "gpt-5-nano",
          messages: [
            {
              role: "system", 
              content: "Du sammanfattar resultat från kravgruppering på svenska på ett professionellt sätt."
            },
            {
              role: "user",
              content: prompt
            }
          ],
        }, { signal: controller.signal, timeout: 30000 });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as any).name === 'AbortError') {
          throw new Error('OpenAI API call timed out after 30 seconds');
        }
        throw error;
      }

      return response.choices[0].message.content?.trim() || 'Gruppering slutförd.';

    } catch (error) {
      console.error("Error generating summary:", error);
      return 'Gruppering slutförd utan sammanfattning.';
    }
  }

  private extractJsonPayload(response: any): any | null {
    if (!response) {
      return null;
    }

    const tryParse = (payload: unknown) => {
      if (typeof payload === "string" && payload.trim()) {
        try {
          return JSON.parse(payload);
        } catch {
          return null;
        }
      }
      return null;
    };

    const inspectContentArray = (content: any[]): any | null => {
      for (const part of content ?? []) {
        if (!part) {
          continue;
        }
        if (part.type === "json" && part.json) {
          return part.json;
        }
        if (typeof part.text === "string") {
          const parsed = tryParse(part.text);
          if (parsed) {
            return parsed;
          }
        }
      }
      return null;
    };

    if (Array.isArray(response.output)) {
      for (const block of response.output) {
        if (!block) {
          continue;
        }
        if (block.type === "output_json" && Array.isArray(block.content)) {
          const parsed = inspectContentArray(block.content);
          if (parsed) {
            return parsed;
          }
        }
        if (block.type === "output_text" && Array.isArray(block.content)) {
          const parsed = inspectContentArray(block.content);
          if (parsed) {
            return parsed;
          }
        }
      }
    }

    if (typeof response.output_text === "string") {
      const parsed = tryParse(response.output_text);
      if (parsed) {
        return parsed;
      }
    }

    if (response.response && typeof response.response.output_text === "string") {
      const parsed = tryParse(response.response.output_text);
      if (parsed) {
        return parsed;
      }
    }

    const choiceContent = response.choices?.[0]?.message?.content;
    if (typeof choiceContent === "string") {
      return tryParse(choiceContent);
    }

    return null;
  }
}

export const openaiService = new OpenAIService();
