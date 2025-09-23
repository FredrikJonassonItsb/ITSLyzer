import OpenAI from "openai";
import type { Requirement, RequirementGroup } from "@shared/schema";

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
   * Analyzes requirement text in Swedish and groups similar ones together
   */
  async groupRequirements(requirements: Requirement[]): Promise<GroupingResult> {
    if (!requirements.length) {
      return { groups: [], ungroupedRequirements: [] };
    }

    // Limit batch size to avoid token limits
    const BATCH_SIZE = 30; // Reduced for better quality
    const allGroups: RequirementGroup[] = [];
    const ungroupedRequirements: string[] = [];

    // Process in batches with retry
    for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
      const batch = requirements.slice(i, i + BATCH_SIZE);
      const batchResult = await this.groupRequirementsBatchWithRetry(batch);
      
      // Generate unique group IDs for this batch
      batchResult.groups.forEach(group => {
        group.groupId = this.generateUniqueGroupId();
      });
      
      allGroups.push(...batchResult.groups);
      ungroupedRequirements.push(...batchResult.ungroupedRequirements);
    }

    // Consolidate cross-batch similar groups if we have multiple batches
    if (requirements.length > BATCH_SIZE && allGroups.length > 1) {
      return await this.consolidateGroups(allGroups, ungroupedRequirements, requirements);
    }

    return { groups: allGroups, ungroupedRequirements };
  }

  private async groupRequirementsBatchWithRetry(requirements: Requirement[], maxRetries: number = 2): Promise<GroupingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting AI grouping (attempt ${attempt}/${maxRetries}) for ${requirements.length} requirements...`);
        return await this.groupRequirementsBatch(requirements);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`AI grouping attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`All ${maxRetries} attempts failed, falling back to ungrouped:`, lastError?.message);
    
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

  private async groupRequirementsBatch(requirements: Requirement[]): Promise<GroupingResult> {
    try {
      // Prepare requirements for analysis
      const requirementTexts = requirements.map(req => ({
        id: req.id,
        text: req.text,
        type: req.requirement_type,
        category: req.requirement_category
      }));

      const prompt = `Du är en expert på svensk upphandling och kravanalys. Analysera följande lista med IT-krav och gruppera dem baserat på liknande funktionalitet eller teknikområde.

Krav att analysera:
${requirementTexts.map((req, idx) => `${idx + 1}. [ID: ${req.id}] ${req.text} (Typ: ${req.type || 'Okänd'}, Kategori: ${req.category || 'Okänd'})`).join('\n')}

Instruktioner:
1. Gruppera krav som handlar om samma tekniska område eller funktionalitet
2. En grupp ska ha minst 2 krav för att vara meningsfull
3. Välj ett representativt krav för varje grupp (vanligast förekommande eller mest beskrivande)
4. Beräkna en likhetspoäng 0-100 för varje grupp baserat på hur lika kraven är
5. Föreslå en kategori/tema för varje grupp

Svara med JSON i följande format:
{
  "groups": [
    {
      "groupId": "grupp-1",
      "representativeId": "krav-id-för-representativt-krav",
      "members": ["krav-id-1", "krav-id-2", "krav-id-3"],
      "similarityScore": 85,
      "category": "Säkerhet och autentisering"
    }
  ],
  "ungroupedRequirements": ["krav-id-som-inte-passar-någon-grupp"]
}

Gruppera endast krav som verkligen är relaterade. Lämna krav ogruperade om de inte passar naturligt ihop med andra.`;

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      let response;
      try {
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Du är en expert på svensk IT-upphandling och kravanalys. Du analyserar tekniska krav och grupperar dem intelligent baserat på funktionalitet och teknikområde. Svara alltid med giltigt JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
        }, { signal: controller.signal, timeout: 60000 });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('OpenAI API call timed out after 60 seconds');
        }
        throw error;
      }

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate and clean the result
      const groups: RequirementGroup[] = (result.groups || [])
        .filter((group: any) => 
          group.representativeId && 
          Array.isArray(group.members) && 
          group.members.length >= 2
        )
        .map((group: any) => ({
          groupId: this.generateUniqueGroupId(),
          representativeId: group.representativeId,
          members: group.members.filter((id: string) => 
            requirements.some(req => req.id === id)
          ),
          similarityScore: Math.max(0, Math.min(100, group.similarityScore || 0)),
          category: group.category || 'Okategoriserad'
        }));

      const ungroupedRequirements: string[] = (result.ungroupedRequirements || [])
        .filter((id: string) => requirements.some(req => req.id === id));

      // Add any missing requirements to ungrouped
      const groupedIds = new Set(groups.flatMap(g => g.members));
      const missingIds = requirements
        .map(req => req.id)
        .filter(id => !groupedIds.has(id) && !ungroupedRequirements.includes(id));
      
      ungroupedRequirements.push(...missingIds);

      return { groups, ungroupedRequirements };

    } catch (error) {
      console.error("Error in AI grouping:", error);
      
      // Fallback: return all requirements as ungrouped
      return {
        groups: [],
        ungroupedRequirements: requirements.map(req => req.id)
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
          model: "gpt-4o",
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
        if (error.name === 'AbortError') {
          throw new Error('OpenAI API call timed out after 30 seconds');
        }
        throw error;
      }

      return response.choices[0].message.content?.trim() || 'Okategoriserad';

    } catch (error) {
      console.error("Error categorizing requirement:", error);
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
          model: "gpt-4o",
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
        if (error.name === 'AbortError') {
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
}

export const openaiService = new OpenAIService();