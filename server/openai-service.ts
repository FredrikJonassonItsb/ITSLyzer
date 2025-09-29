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
   * Groups requirements per category with high sensitivity for similarity
   */
  async groupRequirements(requirements: Requirement[], progressCallback?: (message: string, type?: string, step?: number, total?: number) => void): Promise<GroupingResult> {
    if (!requirements.length) {
      return { groups: [], ungroupedRequirements: [] };
    }

    // First group requirements by category
    const categoryGroups = new Map<string, Requirement[]>();
    requirements.forEach(req => {
      const category = req.requirement_category || 'Okategoriserad';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(req);
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

      // Process category in smaller batches for better quality
      const BATCH_SIZE = 20; // Smaller batches for higher quality within categories
      const totalBatches = Math.ceil(categoryRequirements.length / BATCH_SIZE);
      
      for (let i = 0; i < categoryRequirements.length; i += BATCH_SIZE) {
        const batch = categoryRequirements.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        
        // Skip batches with less than 2 requirements
        if (batch.length < 2) {
          ungroupedRequirements.push(...batch.map(req => req.id));
          continue;
        }

        progressCallback?.(`🤖 AI-analyserar batch ${batchNumber}/${totalBatches} i kategori "${category}"`, 'progress');
        const batchResult = await this.groupRequirementsBatchWithRetry(batch, progressCallback);
        
        // Generate unique group IDs for this batch
        batchResult.groups.forEach(group => {
          group.groupId = this.generateUniqueGroupId();
          group.category = category; // Ensure category is preserved
        });
        
        allGroups.push(...batchResult.groups);
        ungroupedRequirements.push(...batchResult.ungroupedRequirements);
      }
      
      processedCategories++;
    }

    console.log(`🎯 AI grouping completed: ${allGroups.length} groups across ${categoryGroups.size} categories`);
    progressCallback?.(`🎯 Gruppering slutförd: ${allGroups.length} grupper skapade`, 'success');
    return { groups: allGroups, ungroupedRequirements };
  }

  private async groupRequirementsBatchWithRetry(requirements: Requirement[], progressCallback?: (message: string, type?: string, step?: number, total?: number) => void, maxRetries: number = 2): Promise<GroupingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting AI grouping (attempt ${attempt}/${maxRetries}) for ${requirements.length} requirements...`);
        if (attempt > 1) {
          progressCallback?.(`🔄 Försök ${attempt}/${maxRetries} för AI-gruppering...`, 'retry');
        }
        return await this.groupRequirementsBatch(requirements);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`AI grouping attempt ${attempt} failed:`, lastError.message);
        progressCallback?.(`⚠️ Försök ${attempt} misslyckades: ${lastError.message}`, 'warning');
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          progressCallback?.(`⏱️ Väntar ${delay}ms innan nytt försök...`, 'info');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`All ${maxRetries} attempts failed, falling back to ungrouped:`, lastError?.message);
    progressCallback?.(`❌ Alla ${maxRetries} försök misslyckades, lämnar krav ogrouperade`, 'error');
    
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

      const prompt = `Du är en expert på svensk upphandling och kravanalys. Analysera följande lista med IT-krav och gruppera dem baserat på mycket hög likhet inom SAMMA kategori.

Krav att analysera:
${requirementTexts.map((req, idx) => `${idx + 1}. [ID: ${req.id}] ${req.text} (Typ: ${req.type || 'Okänd'}, Kategori: ${req.category || 'Okänd'})`).join('\n')}

KRITISKA INSTRUKTIONER:
1. **ENDAST GRUPPERA KRAV INOM SAMMA KATEGORI** - Krav från olika kategorier får ALDRIG grupperas tillsammans
2. **HÖG KÄNSLIGHET** - Gruppera endast krav som är nästan identiska eller extremt lika (80%+ likhet)
3. **Strikt likhetsbedömning** - Krav måste ha mycket liknande ordval, struktur och specifik funktionalitet
4. En grupp ska ha minst 2 krav för att vara meningsfull
5. Välj det mest representativa kravet för varje grupp (tydligast formulerat)
6. Beräkna en likhetspoäng 80-100 för varje grupp (under 80 ska ej grupperas)
7. Använd exakt samma kategorinamn som anges för kraven

Svara med JSON i följande format:
{
  "groups": [
    {
      "groupId": "grupp-1",
      "representativeId": "krav-id-för-representativt-krav",
      "members": ["krav-id-1", "krav-id-2", "krav-id-3"],
      "similarityScore": 85,
      "category": "Exakt samma kategorinamn från input"
    }
  ],
  "ungroupedRequirements": ["krav-id-som-inte-passar-strikt-gruppering"]
}

VAR MYCKET SELEKTIV - Hellre för få grupper än för många. Lämna krav ogruperade om de inte uppfyller de höga kraven på likhet INOM SAMMA KATEGORI.`;

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      let response;
      try {
        response = await openai.chat.completions.create({
          model: "gpt-5-nano",
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
        if ((error as any).name === 'AbortError') {
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
      console.error("Error in AI grouping:", error as Error);
      
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
}

export const openaiService = new OpenAIService();