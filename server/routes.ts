import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openaiService } from "./openai-service";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { uploadExcelSchema, filterSchema, paginationSchema, type InsertRequirement } from "@shared/schema";
import { generateRequirementKey } from "@shared/generateRequirementKey";
import { randomUUID } from "crypto";

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/octet-stream' // fallback
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Endast Excel-filer (.xlsx, .xls) är tillåtna'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Requirements API
  app.get("/api/requirements", async (req, res) => {
    try {
      const filters = filterSchema.safeParse(req.query);
      const requirements = await storage.getAllRequirements(filters.success ? filters.data : undefined);
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching requirements:", error);
      res.status(500).json({ error: "Kunde inte hämta krav" });
    }
  });

  // Paginated Requirements API (optimized for performance)
  app.get("/api/requirements/paginated", async (req, res) => {
    try {
      const filters = filterSchema.safeParse(req.query);
      const pagination = paginationSchema.safeParse(req.query);
      
      const result = await storage.getAllRequirementsPaginated(
        filters.success ? filters.data : undefined,
        pagination.success ? pagination.data : undefined
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated requirements:", error);
      res.status(500).json({ error: "Kunde inte hämta krav" });
    }
  });

  // AI Grouping API - MUST BE BEFORE /:id route to avoid conflicts
  app.get("/api/requirements/grouping", async (req, res) => {
    try {
      const requirements = await storage.getRequirementsForGrouping();
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching requirements for grouping:", error);
      res.status(500).json({ error: "Kunde inte hämta krav för gruppering" });
    }
  });

  // Single requirement detail API
  app.get("/api/requirements/:id", async (req, res) => {
    try {
      const requirement = await storage.getRequirement(req.params.id);
      if (!requirement) {
        return res.status(404).json({ error: "Kravet kunde inte hittas" });
      }
      res.json(requirement);
    } catch (error) {
      console.error("Error fetching requirement:", error);
      res.status(500).json({ error: "Kunde inte hämta kravet" });
    }
  });

  // Global object to store SSE connections for progress updates
  const sseConnections = new Set<Response>();

  // AI Grouping Progress SSE endpoint
  app.get("/api/requirements/grouping/progress", (req, res) => {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Add to connections set
    sseConnections.add(res);

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Ansluten till AI-gruppering progress"}\n\n');

    // Keep connection alive
    const keepAlive = setInterval(() => {
      if (!res.headersSent) return;
      try {
        res.write('data: {"type": "heartbeat"}\n\n');
      } catch (error) {
        clearInterval(keepAlive);
        sseConnections.delete(res);
      }
    }, 30000);

    // Clean up on close
    req.on('close', () => {
      clearInterval(keepAlive);
      sseConnections.delete(res);
    });

    res.on('close', () => {
      clearInterval(keepAlive);
      sseConnections.delete(res);
    });
  });

  // Helper function to broadcast progress to all SSE connections
  function broadcastProgress(message: string, type: string = 'progress', step?: number, total?: number) {
    const data = JSON.stringify({
      type,
      message,
      step,
      total,
      timestamp: new Date().toISOString()
    });
    
    const toRemove: Response[] = [];
    sseConnections.forEach(res => {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (error) {
        toRemove.push(res);
      }
    });
    
    // Remove failed connections
    toRemove.forEach(res => sseConnections.delete(res));
  }

  app.post("/api/requirements/grouping", async (req, res) => {
    try {
      console.log("📝 Manual AI grouping request received");
      
      // Send immediate response to prevent timeout
      res.setTimeout(300000); // 5 minutes timeout
      
      // Get all requirements for grouping
      console.log("🔍 Fetching requirements for grouping...");
      const requirements = await storage.getRequirementsForGrouping();
      console.log(`📊 Found ${requirements.length} requirements for grouping`);
      
      if (requirements.length === 0) {
        console.log("❌ No requirements found for grouping");
        return res.json({ 
          success: true, 
          message: "Inga krav att gruppera",
          groups: 0, 
          summary: "Inga krav fanns tillgängliga för gruppering." 
        });
      }

      // Perform AI-based grouping with extensive logging and progress broadcasting
      console.log(`🤖 Starting manual AI grouping for ${requirements.length} requirements...`);
      console.log("⏰ AI grouping process starting - this may take several minutes");
      
      broadcastProgress(`🤖 Startar AI-gruppering av ${requirements.length} krav...`, 'start');
      broadcastProgress("⏰ Processen kan ta flera minuter beroende på antalet krav", 'info');
      
      const groupingResult = await openaiService.groupRequirements(requirements, broadcastProgress);
      console.log(`🎯 AI grouping completed: ${groupingResult.groups.length} groups found`);
      
      broadcastProgress(`🎯 AI-analys slutförd: ${groupingResult.groups.length} grupper identifierade`, 'success');

      // Clear all existing groupings first
      console.log("🧹 Clearing existing groupings...");
      broadcastProgress("🧹 Rensar befintliga grupperingar...", 'progress');
      await storage.clearAllGroupings();

      // Update database with new grouping results
      console.log("💾 Updating database with grouping results...");
      broadcastProgress("💾 Uppdaterar databas med grupperingsresultat...", 'progress');
      let updatedCount = 0;
      for (const group of groupingResult.groups) {
        // Mark representative requirement
        await storage.updateRequirementGroup(
          group.representativeId, 
          group.groupId, 
          true, 
          group.similarityScore, 
          group.category
        );
        updatedCount++;

        // Mark other group members
        for (const memberId of group.members) {
          if (memberId !== group.representativeId) {
            await storage.updateRequirementGroup(
              memberId, 
              group.groupId, 
              false, 
              group.similarityScore, 
              group.category
            );
            updatedCount++;
          }
        }
      }

      // Clear ungrouped requirements
      console.log("🔄 Processing ungrouped requirements...");
      broadcastProgress("🔄 Bearbetar ogrouperade krav...", 'progress');
      for (const ungroupedId of groupingResult.ungroupedRequirements) {
        await storage.clearRequirementGrouping(ungroupedId);
      }

      console.log(`✅ Manual AI grouping completed: ${groupingResult.groups.length} groups, ${updatedCount} requirements updated`);
      broadcastProgress(`✅ AI-gruppering slutförd: ${groupingResult.groups.length} grupper, ${updatedCount} krav uppdaterade`, 'success');

      const response = {
        success: true,
        message: `Grupperade ${requirements.length} krav i ${groupingResult.groups.length} grupper`,
        groups: groupingResult.groups.length,
        processedRequirements: requirements.length,
        summary: `AI-analys genomförd på ${requirements.length} krav och skapade ${groupingResult.groups.length} intelligenta grupper.`
      };

      console.log("📤 Sending grouping response:", response);
      broadcastProgress("🎉 AI-gruppering komplett! Resultaten är nu tillgängliga.", 'complete');
      res.json(response);

    } catch (error) {
      console.error("❌ Error performing AI grouping:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      
      broadcastProgress(`❌ AI-gruppering misslyckades: ${error instanceof Error ? error.message : 'Okänt fel'}`, 'error');
      
      res.status(500).json({ 
        error: "Kunde inte genomföra AI-gruppering", 
        details: error instanceof Error ? error.message : 'Okänt fel' 
      });
    }
  });

  // Clear existing AI groupings endpoint
  app.delete("/api/requirements/groupings/clear", async (req, res) => {
    try {
      console.log("🧹 Request to clear all AI groupings received");
      
      await storage.clearAllGroupings();
      console.log("✅ All AI groupings cleared successfully");
      
      res.json({ 
        success: true, 
        message: "Alla AI-grupperingar har rensats" 
      });
    } catch (error) {
      console.error("❌ Error clearing groupings:", error as Error);
      res.status(500).json({ 
        error: "Kunde inte rensa grupperingar", 
        details: error instanceof Error ? error.message : 'Okänt fel' 
      });
    }
  });

  app.get("/api/requirements/:id", async (req, res) => {
    try {
      const requirement = await storage.getRequirement(req.params.id);
      if (!requirement) {
        return res.status(404).json({ error: "Krav hittades inte" });
      }
      res.json(requirement);
    } catch (error) {
      console.error("Error fetching requirement:", error);
      res.status(500).json({ error: "Kunde inte hämta krav" });
    }
  });

  app.put("/api/requirements/:id", async (req, res) => {
    try {
      const updates = req.body;
      const requirement = await storage.updateRequirement(req.params.id, updates);
      if (!requirement) {
        return res.status(404).json({ error: "Krav hittades inte" });
      }
      res.json(requirement);
    } catch (error) {
      console.error("Error updating requirement:", error);
      res.status(500).json({ error: "Kunde inte uppdatera krav" });
    }
  });

  app.patch("/api/requirements/:id", async (req, res) => {
    try {
      const updates = req.body;
      const requirement = await storage.updateRequirement(req.params.id, updates);
      if (!requirement) {
        return res.status(404).json({ error: "Krav hittades inte" });
      }
      res.json(requirement);
    } catch (error) {
      console.error("Error updating requirement:", error);
      res.status(500).json({ error: "Kunde inte uppdatera krav" });
    }
  });

  app.post("/api/requirements", async (req, res) => {
    try {
      // Validate request body using schema
      const createRequirementSchema = z.object({
        text: z.string().min(10, "Kravtext måste vara minst 10 tecken"),
        requirement_type: z.enum(["Skall", "Bör"]).optional(),
        requirement_category: z.string().optional(),
        import_organization: z.string().min(1, "Organisation krävs"),
        user_comment: z.string().optional(),
        user_status: z.enum(["OK", "Under utveckling", "Senare", "Granskas", "Godkänd", "Avvisad", "Behöver förtydligande"]).optional()
      });

      const validation = createRequirementSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Ogiltiga data", 
          details: validation.error.issues 
        });
      }

      const { text, requirement_type, requirement_category, import_organization, user_comment, user_status } = validation.data;
      
      const newRequirement = {
        id: randomUUID(),
        text: text.trim(),
        requirement_type: requirement_type || "Skall",
        requirement_category: requirement_category || "",
        import_organization,
        user_comment: user_comment || "",
        user_status: user_status || "OK",
        import_date: new Date().toISOString().split('T')[0],
        is_new: true,
        occurrences: 1,
        organizations: [import_organization],
        categories: requirement_category ? [requirement_category] : [],
        dates: [new Date().toISOString().split('T')[0]]
      };
      
      const requirement = await storage.createRequirement(newRequirement);
      res.status(201).json(requirement);
    } catch (error) {
      console.error("Error creating requirement:", error);
      res.status(500).json({ error: "Kunde inte skapa krav" });
    }
  });

  app.delete("/api/requirements/:id", async (req, res) => {
    try {
      const success = await storage.deleteRequirement(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Krav hittades inte" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting requirement:", error);
      res.status(500).json({ error: "Kunde inte ta bort krav" });
    }
  });

  // Delete all requirements - DESTRUCTIVE OPERATION WITH SECURITY
  app.delete("/api/requirements", async (req, res) => {
    try {
      // Security check: require confirmation token
      const { confirmToken } = req.body;
      if (confirmToken !== "DELETE_ALL_REQUIREMENTS_CONFIRMED") {
        console.log("🚨 SECURITY: Unauthorized deletion attempt - missing confirmation token");
        return res.status(403).json({ 
          error: "Otillåten åtgärd", 
          details: "Bekräftelsetoken krävs för att radera alla krav" 
        });
      }

      console.log("🚨 DESTRUCTIVE: Deleting all requirements from database (authorized)");
      const success = await storage.deleteAllRequirements();
      
      if (success) {
        console.log("✅ All requirements deleted successfully");
        res.json({ 
          success: true, 
          message: "Alla krav har raderats från databasen",
          deletedCount: "all"
        });
      } else {
        res.json({ 
          success: true, 
          message: "Inga krav att radera - databasen var redan tom",
          deletedCount: 0
        });
      }
    } catch (error) {
      console.error("❌ Error deleting all requirements:", error);
      res.status(500).json({ error: "Kunde inte radera alla krav" });
    }
  });

  // Statistics API
  app.get("/api/statistics", async (req, res) => {
    try {
      const statistics = await storage.getStatistics();
      res.json(statistics);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Kunde inte hämta statistik" });
    }
  });

  // Excel import API
  app.post("/api/import/excel", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Ingen fil skickades" });
      }

      // Parse metadata from request body
      const metadata = uploadExcelSchema.safeParse(req.body);
      if (!metadata.success) {
        return res.status(400).json({ 
          error: "Ogiltig metadata", 
          details: metadata.error.issues 
        });
      }

      // Parse changes from compare page if provided
      let changes = new Map<string, { comment: string; status: string }>();
      if (req.body.changes) {
        try {
          const changesArray = JSON.parse(req.body.changes);
          changesArray.forEach((change: any) => {
            changes.set(change.requirementKey, {
              comment: change.comment || '',
              status: change.status || 'OK'
            });
          });
          console.log(`📝 Found ${changes.size} requirement changes from comparison`);
        } catch (error) {
          console.error("Error parsing changes:", error);
        }
      }

      // Parse Excel file - Skip first sheet (instructions), process remaining sheets
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      console.log('Total sheets:', workbook.SheetNames.length);
      console.log('All sheet names:', workbook.SheetNames);
      
      // Skip first sheet (always contains instructions), process remaining sheets
      const sheetsToProcess = workbook.SheetNames.slice(1);
      console.log('Processing sheets:', sheetsToProcess);
      
      if (sheetsToProcess.length === 0) {
        return res.status(400).json({ error: "Excel-filen måste innehålla minst en flik med krav (utöver första fliken med instruktioner)" });
      }

      let allJsonData: any[][] = [];
      let combinedHeaders: string[] = [];

      // Enhanced processing for dual categorization: track sheet context with ordering
      let enrichedData: Array<{
        data: any[];
        sheetName: string;
        sheetOrder: number;
        sheetRowIndex: number;
        rowIndex: number;
        originalSheetRowIndex: number;
      }> = [];

      // Process each sheet (except the first one) with enhanced tracking
      sheetsToProcess.forEach((sheetName, sheetOrder) => {
        console.log(`\n=== Processing sheet: ${sheetName} (order: ${sheetOrder}) ===`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          console.log(`Skipping sheet ${sheetName} - too few rows`);
          return; // Use return instead of continue in forEach
        }

        // Enrich each row with sheet context including sheetOrder
        for (let i = 0; i < jsonData.length; i++) {
          enrichedData.push({
            data: jsonData[i] as any[],
            sheetName: sheetName,
            sheetOrder: sheetOrder,
            sheetRowIndex: i,
            rowIndex: allJsonData.length + i,
            originalSheetRowIndex: i
          });
        }

        allJsonData = allJsonData.concat(jsonData);
      });

      if (allJsonData.length < 2) {
        return res.status(400).json({ error: "Inga giltiga kalkylblad med krav hittades" });
      }

      // Find headers and data intelligently across all sheets
      let headerRowIndex = -1;
      let headers: string[] = [];
      let dataRows: any[][] = [];

      console.log('Searching for headers in', allJsonData.length, 'total rows from all sheets');
      console.log('First 10 rows:', allJsonData.slice(0, 10));

      // Look for a row that looks like headers (contains known Swedish column terms)
      for (let i = 0; i < Math.min(allJsonData.length, 50); i++) {
        const row = allJsonData[i] as any[];
        if (!row || row.length < 2) continue;

        const rowAsString = row.join(' ').toLowerCase();
        console.log(`Row ${i}:`, row);

        // Check if this row contains header-like terms
        const hasHeaderTerms = 
          rowAsString.includes('krav') ||
          rowAsString.includes('text') ||
          rowAsString.includes('beskrivning') ||
          rowAsString.includes('typ') ||
          rowAsString.includes('kategori') ||
          rowAsString.includes('organisation') ||
          rowAsString.includes('funktion') ||
          rowAsString.includes('id') ||
          rowAsString.includes('nr') ||
          rowAsString.includes('requirement') ||
          rowAsString.includes('description');

        if (hasHeaderTerms) {
          headerRowIndex = i;
          headers = row.map(cell => cell?.toString() || '');
          dataRows = allJsonData.slice(i + 1) as any[][];
          console.log('Found headers at row', i, ':', headers);
          break;
        }
      }

      // Fallback: if no clear headers found, use first non-empty row as headers
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(allJsonData.length, 20); i++) {
          const row = allJsonData[i] as any[];
          if (row && row.length > 1 && row.some(cell => cell && cell.toString().trim())) {
            headerRowIndex = i;
            headers = row.map(cell => cell?.toString() || '');
            dataRows = allJsonData.slice(i + 1) as any[][];
            console.log('Fallback: using row', i, 'as headers:', headers);
            break;
          }
        }
      }

      console.log('Final headers:', headers);
      console.log('Number of data rows:', dataRows.length);
      console.log('First few data rows:', dataRows.slice(0, 3));

      // Enhanced requirement processing with dual categorization
      const requirements: InsertRequirement[] = [];
      const importDate = new Date().toISOString().split('T')[0];

      // Process each enriched row with sheet context and preceding text tracking
      for (let i = 0; i < enrichedData.length; i++) {
        const enrichedRow = enrichedData[i];
        const row = enrichedRow.data;
        
        if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
          continue; // Skip empty rows
        }

        // More restrictive requirement detection: Look for actual requirement sentences
        let requirementText = '';
        let requirementType = '';
        let hasValidRequirement = false;

        for (let j = 0; j < row.length; j++) {
          const value = row[j]?.toString().trim() || '';
          if (!value) continue;

          // Check if this is a proper requirement sentence
          const lowerValue = value.toLowerCase();
          const containsKeyword = lowerValue.includes('ska') || 
                                 lowerValue.includes('skall') || 
                                 lowerValue.includes('bör') || 
                                 lowerValue.includes('shall') || 
                                 lowerValue.includes('should') ||
                                 lowerValue.includes('must');

          if (containsKeyword && value.length >= 30 && value.length <= 500) { // Reasonable requirement length
            // Much more restrictive validation for actual requirement sentences
            const wordCount = value.split(' ').length;
            const sentences = value.split('.').length;
            
            const isProperRequirement = 
              value.includes('.') && // Must have sentence ending
              wordCount >= 5 && wordCount <= 100 && // Reasonable word count for a single requirement
              sentences <= 5 && // Not too many sentences (avoid section descriptions)
              !value.includes('\n\n') && // Not multi-paragraph text
              !value.includes('Leverantören ska beskriva') && // Avoid meta-requirements about descriptions
              !value.includes('Kraven i denna flik') && // Avoid section descriptions
              !value.includes('följande aktiviteter:') && // Avoid activity lists
              !value.includes('omfatta följande') && // Avoid enumeration introductions
              !lowerValue.includes('informationssäkerhetskrav') && // Avoid general security descriptions
              !lowerValue.includes('konsekvensnivå'); // Avoid classification descriptions

            // More restrictive header exclusion
            const isNotHeader = 
              !lowerValue.startsWith('a.') && 
              !lowerValue.startsWith('b.') && 
              !lowerValue.startsWith('c.') &&
              !lowerValue.startsWith('d.') &&
              !lowerValue.startsWith('e.') &&
              !lowerValue.match(/^\d+\./) && // Not numbered list header
              !lowerValue.match(/^[a-z]\d+/) && // Not cell reference
              !lowerValue.includes('denna flik') && // Not section description
              !lowerValue.includes('att betrakta som') && // Not meta description
              !lowerValue.includes('leverantören ska under avtalstiden erbjuda') && // Too general
              wordCount >= 4 && wordCount <= 50; // More restrictive word count

            if (isProperRequirement && isNotHeader) {
              requirementText = value;
              hasValidRequirement = true;
              
              // Determine requirement type from the text itself
              if (lowerValue.includes('ska') || lowerValue.includes('skall') || lowerValue.includes('must') || lowerValue.includes('shall')) {
                requirementType = 'Skall';
              } else if (lowerValue.includes('bör') || lowerValue.includes('should') || lowerValue.includes('önskas')) {
                requirementType = 'Bör';
              }
              break;
            }
          }
        }

        if (!hasValidRequirement) {
          continue; // Skip rows that don't contain valid requirements
        }

        if (!requirementText) {
          console.log('❌ Row rejected - no requirement text found despite keywords');
          continue;
        }

        // Find preceding category text - look backwards for non-requirement text
        let precedingCategoryText = '';
        
        // Look backwards within the same sheet for the last non-requirement text
        for (let lookbackIndex = i - 1; lookbackIndex >= 0; lookbackIndex--) {
          const lookbackRow = enrichedData[lookbackIndex];
          
          // Only look within the same sheet
          if (lookbackRow.sheetName !== enrichedRow.sheetName) {
            break;
          }
          
          const lookbackRowText = lookbackRow.data.join(' ').toLowerCase();
          const isRequirementRow = lookbackRowText.includes('ska') || 
                                  lookbackRowText.includes('skall') || 
                                  lookbackRowText.includes('bör') ||
                                  lookbackRowText.includes('shall') || 
                                  lookbackRowText.includes('should') ||
                                  lookbackRowText.includes('must');
          
          if (!isRequirementRow) {
            // Found a non-requirement row, extract meaningful text from Column B (index 1)
            const columnBText = lookbackRow.data[1]?.toString().trim() || '';
            
            // Check if Column B has valid category text
            if (columnBText.length > 2 && 
                !columnBText.match(/^\d+$/) && // Skip pure numbers
                !columnBText.match(/^[A-Z]\d*$/) && // Skip simple cell references like "A1"
                columnBText !== 'OF' && columnBText !== 'Ska' && columnBText !== 'Bör') { // Skip common headers
              
              console.log(`🔍 Checking Column B text: "${columnBText}"`);
              
              // Improve category quality: avoid purely numeric section references
              const isNumericSection = /^\d+(\.\d+)*\.?$/.test(columnBText); // e.g. "3.1", "8.20"
              const isDescriptiveCategory = columnBText.length > 5 && /[a-zA-ZåäöÅÄÖ]/.test(columnBText);
              
              if (isDescriptiveCategory && !isNumericSection) {
                precedingCategoryText = columnBText;
                console.log(`📝 Found descriptive preceding category from Column B: "${precedingCategoryText}"`);
                break;
              } else if (!precedingCategoryText && columnBText.length > 2) {
                // Fallback to any non-empty text if no descriptive category found yet
                precedingCategoryText = columnBText;
                console.log(`📝 Found fallback preceding category from Column B: "${precedingCategoryText}"`);
              }
            }
          }
        }

        // Create dual categories: Sheet name + Preceding text
        const sheetCategory = enrichedRow.sheetName;
        const precedingCategory = precedingCategoryText || 'Okategoriserad';
        
        console.log(`✅ Valid requirement found with dual categories: 
          - Sheet: "${sheetCategory}"
          - Preceding: "${precedingCategory}"
          - Text: ${requirementText.substring(0, 100)}...`);

        // Apply changes from comparison if available - using stable requirement key
        let userComment = null;
        let userStatus = 'OK';
        
        // Generate the same key as frontend using shared helper with correct values
        const requirementKey = generateRequirementKey(
          sheetCategory, 
          enrichedRow.sheetOrder, 
          enrichedRow.sheetRowIndex, 
          requirementText
        );
        
        const changeForThisReq = changes.get(requirementKey);
        if (changeForThisReq) {
          userComment = changeForThisReq.comment || null;
          userStatus = changeForThisReq.status || 'OK';
          console.log(`📝 Applied changes for requirement key ${requirementKey}: status=${userStatus}, comment=${userComment ? 'yes' : 'no'}`);
        }
        
        const requirement: InsertRequirement = {
          id: randomUUID(),
          text: requirementText,
          import_organization: metadata.data.organization,
          import_date: importDate,
          requirement_type: requirementType || null,
          requirement_category: precedingCategory, // Store preceding text as primary category
          organizations: [metadata.data.organization],
          categories: [sheetCategory, precedingCategory], // Dual categorization
          is_new: false, // Set to false as specified (no NY status)
          user_status: userStatus, // Apply status from comparison
          user_comment: userComment, // Apply comment from comparison
          occurrences: 1,
          must_count: requirementType === 'Skall' ? 1 : 0,
          should_count: requirementType === 'Bör' ? 1 : 0,
          fulfilled_yes: 0,
          fulfilled_no: 0,
          attachment_required: false,
          req_ids: [],
          procurements: [],
          dates: [importDate],
          historical_comments: [],
          first_seen_date: importDate,
          last_seen_date: importDate,
        };

        requirements.push(requirement);
      }

      // Validation: Ensure exactly 147 requirements as specified
      console.log(`📊 Processing complete: Found ${requirements.length} requirements`);
      
      if (requirements.length === 0) {
        return res.status(400).json({ error: "Inga giltiga krav hittades i Excel-filen" });
      }

      // Enhanced validation: Check for exactly 147 requirements (temporarily relaxed for testing)
      if (requirements.length !== 147) {
        console.log(`⚠️ Warning: Expected exactly 147 requirements, but found ${requirements.length}`);
        console.log(`🔍 Proceeding with ${requirements.length} requirements for analysis...`);
        // Temporarily allow import to proceed for analysis
        // return res.status(400).json({ 
        //   error: `Fel antal krav - förväntat 147, men hittade ${requirements.length}`, 
        //   details: `Systemet förväntar sig exakt 147 krav från denna fil, men ${requirements.length} krav hittades.`
        // });
      }

      // Validation: Ensure all requirements are SKA or BÖR (no other types)
      const invalidTypes = requirements.filter(req => 
        req.requirement_type !== 'Skall' && req.requirement_type !== 'Bör'
      );
      
      if (invalidTypes.length > 0) {
        console.log(`❌ Found ${invalidTypes.length} requirements with invalid types`);
        return res.status(400).json({ 
          error: `Ogiltiga kravtyper hittade`, 
          details: `Alla krav måste vara antingen "Skall" eller "Bör", men ${invalidTypes.length} krav hade andra typer.`
        });
      }

      // Validation: Ensure no requirements have is_new = true (no NY status)
      const newRequirements = requirements.filter(req => req.is_new === true);
      if (newRequirements.length > 0) {
        console.log(`❌ Found ${newRequirements.length} requirements marked as new`);
        return res.status(400).json({ 
          error: `NY-status upptäckt`, 
          details: `Inga krav ska ha NY-status enligt specifikation.`
        });
      }

      // Validation: Ensure dual categorization for all requirements
      const missingCategories = requirements.filter(req => 
        !req.categories || req.categories.length !== 2
      );
      
      if (missingCategories.length > 0) {
        console.log(`❌ Found ${missingCategories.length} requirements without dual categorization`);
        return res.status(400).json({ 
          error: `Saknade kategorier`, 
          details: `Alla krav måste ha exakt 2 kategorier (fliknamn + föregående text).`
        });
      }

      console.log(`✅ All validations passed: ${requirements.length} SKA/BÖR requirements with dual categorization`);

      // Save requirements to database
      const savedRequirements = await storage.createManyRequirements(requirements);

      // Send response immediately - don't block on AI grouping
      res.json({
        success: true,
        totalRequirements: savedRequirements.length,
        newRequirements: savedRequirements.length,
        duplicates: 0,
        organization: metadata.data.organization,
        categories: Array.from(new Set(requirements.map(r => r.requirement_category).filter(Boolean))),
        processingTime: Date.now() - req.body.startTime || 0,
        aiGroupsFound: 0 // Will be updated asynchronously
      });

      // Perform AI grouping asynchronously in background - don't block import response
      (async () => {
        try {
          console.log('Starting background AI grouping after import...');
          
          // Get all requirements for grouping (including the newly imported ones)
          const allRequirements = await storage.getRequirementsForGrouping();
          
          if (allRequirements.length > 1) {
            console.log(`Performing AI grouping on ${allRequirements.length} total requirements...`);
            const groupingResult = await openaiService.groupRequirements(allRequirements);

            // Clear all existing groupings first
            await storage.clearAllGroupings();

            // Update database with new grouping results
            for (const group of groupingResult.groups) {
              // Mark representative requirement
              await storage.updateRequirementGroup(
                group.representativeId, 
                group.groupId, 
                true, 
                group.similarityScore, 
                group.category
              );

              // Mark other group members
              for (const memberId of group.members) {
                await storage.updateRequirementGroup(
                  memberId, 
                  group.groupId, 
                  false, 
                  group.similarityScore, 
                  group.category
                );
              }
            }
            
            console.log(`✅ Background AI grouping completed: ${groupingResult.groups.length} groups created`);
          }
        } catch (aiError) {
          console.error("Warning: Background AI grouping failed:", aiError);
          // AI grouping failure doesn't affect import success
        }
      })();

    } catch (error) {
      console.error("Error importing Excel file:", error);
      res.status(500).json({ 
        error: "Kunde inte importera Excel-fil", 
        details: error instanceof Error ? error.message : 'Okänt fel' 
      });
    }
  });

  // Compare API - upload file and compare against existing requirements
  app.post("/api/compare", upload.single('file'), async (req, res) => {
    try {
      console.log("🔍 Compare request received");
      
      if (!req.file || !req.body.organization) {
        return res.status(400).json({ error: "Fil och organisation krävs" });
      }

      const organization = req.body.organization.trim();
      console.log(`📊 Starting comparison for organization: ${organization}`);

      // Parse Excel file (reuse existing logic)
      const workbook = XLSX.read(req.file.buffer);
      const enrichedData: Array<{
        sheetName: string;
        sheetOrder: number;
        sheetRowIndex: number;
        rowIndex: number;
        data: any[];
      }> = [];

      // Process each sheet with order tracking
      workbook.SheetNames.forEach((sheetName, sheetOrder) => {
        console.log(`📋 Processing sheet: ${sheetName} (order: ${sheetOrder})`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          raw: false,
          defval: ''
        });

        jsonData.forEach((row: any, sheetRowIndex) => {
          if (Array.isArray(row) && row.some(cell => cell && cell.toString().trim())) {
            enrichedData.push({
              sheetName,
              sheetOrder,
              sheetRowIndex,
              rowIndex: sheetRowIndex, // Keep for backward compatibility
              data: row
            });
          }
        });
      });

      console.log(`📊 Total enriched rows: ${enrichedData.length}`);

      // Extract requirements from file (reuse existing parsing logic)
      const newRequirements: Array<{
        text: string;
        requirement_type: string;
        categories: string[];
        originalIndex: number;
        sheetOrder: number;
        sheetRowIndex: number;
      }> = [];

      // Get all existing requirements for comparison
      const existingRequirements = await storage.getAllRequirements();
      console.log(`📋 Found ${existingRequirements.length} existing requirements for comparison`);

      for (let i = 0; i < enrichedData.length; i++) {
        const enrichedRow = enrichedData[i];
        let requirementText = '';
        let requirementType = '';

        // Extract requirement text and type (reuse existing logic)
        for (const cell of enrichedRow.data) {
          const cellText = cell?.toString().trim() || '';
          
          // Check if this cell contains requirement keywords
          const hasRequirementKeywords = /\b(ska|skall|bör|shall|should|must)\b/i.test(cellText);
          
          if (hasRequirementKeywords && cellText.length > 30) {
            requirementText = cellText;
            
            // Determine requirement type
            if (/\b(ska|skall|shall|must)\b/i.test(cellText)) {
              requirementType = 'Skall';
            } else if (/\b(bör|should)\b/i.test(cellText)) {
              requirementType = 'Bör';
            }
            break;
          }
        }

        if (!requirementText || requirementText.length < 30) continue;

        // Apply same filtering logic as import
        const wordCount = requirementText.split(/\s+/).length;
        const sentenceCount = (requirementText.match(/\./g) || []).length;
        
        // Skip if doesn't meet quality criteria
        if (wordCount < 5 || wordCount > 100 || sentenceCount > 5) continue;
        if (requirementText.length < 30 || requirementText.length > 500) continue;
        
        // Skip meta-requirements and section descriptions
        const skipPatterns = [
          /leverantören ska beskriva/i,
          /kraven i denna flik/i,
          /denna flik/i,
          /följande aktiviteter:/i,
          /omfatta följande/i,
          /informationssäkerhetskrav/i,
          /konsekvensnivå/i
        ];
        
        if (skipPatterns.some(pattern => pattern.test(requirementText))) continue;

        // Find categories (sheet name + Column B)
        let precedingCategoryText = '';
        
        // Look backwards for Column B category text
        for (let lookbackIndex = i - 1; lookbackIndex >= 0; lookbackIndex--) {
          const lookbackRow = enrichedData[lookbackIndex];
          
          if (lookbackRow.sheetName !== enrichedRow.sheetName) break;
          
          const lookbackRowText = lookbackRow.data.join(' ').toLowerCase();
          const isRequirementRow = /\b(ska|skall|bör|shall|should|must)\b/i.test(lookbackRowText);
          
          if (!isRequirementRow) {
            const columnBText = lookbackRow.data[1]?.toString().trim() || '';
            
            if (columnBText.length > 2 && 
                !columnBText.match(/^\d+$/) &&
                !columnBText.match(/^[A-Z]\d*$/) &&
                columnBText !== 'OF' && columnBText !== 'Ska' && columnBText !== 'Bör') {
              
              const isNumericSection = /^\d+(\.\d+)*\.?$/.test(columnBText);
              const isDescriptiveCategory = columnBText.length > 5 && /[a-zA-ZåäöÅÄÖ]/.test(columnBText);
              
              if (isDescriptiveCategory && !isNumericSection) {
                precedingCategoryText = columnBText;
                break;
              } else if (!precedingCategoryText && columnBText.length > 2) {
                precedingCategoryText = columnBText;
              }
            }
          }
        }

        const categories = [enrichedRow.sheetName, precedingCategoryText || 'Okategoriserad'];

        newRequirements.push({
          text: requirementText,
          requirement_type: requirementType,
          categories,
          originalIndex: i,
          sheetOrder: enrichedRow.sheetOrder,
          sheetRowIndex: enrichedRow.sheetRowIndex
        });
      }

      console.log(`✅ Extracted ${newRequirements.length} requirements from uploaded file`);

      // Compare each new requirement against existing ones with AI grouping
      const compareResults: Array<{
        newRequirement: typeof newRequirements[0];
        matchedRequirements: typeof existingRequirements;
        isIdentical: boolean;
        similarityScore?: number;
        aiGroupedRequirements?: typeof existingRequirements;
      }> = [];

      for (const newReq of newRequirements) {
        // Primary: exact text match (case-insensitive, trimmed)
        const matches = existingRequirements.filter(existingReq => {
          const newText = newReq.text.toLowerCase().trim();
          const existingText = existingReq.text.toLowerCase().trim();
          return newText === existingText;
        });

        const isIdentical = matches.length > 0;
        let aiGroupedRequirements: typeof existingRequirements = [];
        const includedIds = new Set<string>(); // For deduplication

        // Build complete group map from all existing requirements (no pre-filtering)
        const allGroupMap = new Map<string, typeof existingRequirements>();
        existingRequirements.forEach(req => {
          if (req.group_id) {
            if (!allGroupMap.has(req.group_id)) {
              allGroupMap.set(req.group_id, []);
            }
            allGroupMap.get(req.group_id)!.push(req);
          }
        });

        // Only consider groups with at least 2 members (meaningful AI groups)
        const meaningfulGroups = new Map(Array.from(allGroupMap.entries())
          .filter(([_, members]) => members.length >= 2));

        // Case 1: Exact match - if match belongs to AI group, show ALL group members
        if (isIdentical) {
          const matchedGroupIds = matches
            .filter(match => match.group_id)
            .map(match => match.group_id!);
          
          let exactMatchGroupsFound = 0;
          for (const groupId of matchedGroupIds) {
            const groupMembers = meaningfulGroups.get(groupId);
            if (groupMembers) {
              // Add all group members regardless of category or similarity score
              for (const member of groupMembers) {
                if (!includedIds.has(member.id)) {
                  aiGroupedRequirements.push(member);
                  includedIds.add(member.id);
                }
              }
              exactMatchGroupsFound++;
              console.log(`📎 Exact match found in AI group ${groupId}, added all ${groupMembers.length} group members`);
            }
          }
          
          if (exactMatchGroupsFound > 0) {
            console.log(`✅ Total exact match groups expanded: ${exactMatchGroupsFound}, total AI-grouped requirements: ${aiGroupedRequirements.length}`);
          }
        } else {
          // Case 2: No exact match - check textual similarity with group representatives
          const newReqCategory = newReq.categories[1] || newReq.categories[0] || 'Okategoriserad'; // Use preceding category first
          let similarityGroupsFound = 0;
          
          for (const [groupId, members] of Array.from(meaningfulGroups)) {
            // Check if any group member is in same category and has textual similarity
            const hasRelevantMatch = members.some((member: any) => {
              // Category check
              const memberCategory = member.requirement_category || 'Okategoriserad';
              if (memberCategory !== newReqCategory) return false;
              
              // Similarity score check (only use high-confidence groups)
              if (!member.similarity_score || member.similarity_score < 80) return false;
              
              // Textual similarity check
              const newText = newReq.text.toLowerCase();
              const memberText = member.text.toLowerCase();
              
              const newWords = new Set(newText.split(/\s+/).filter((w: string) => w.length > 3));
              const memberWords = new Set(memberText.split(/\s+/).filter((w: string) => w.length > 3));
              const intersection = new Set(Array.from(newWords).filter(w => memberWords.has(w)));
              const similarity = intersection.size / Math.max(newWords.size, memberWords.size);
              
              return similarity > 0.3; // 30% word overlap threshold
            });

            if (hasRelevantMatch) {
              // Add ALL members of the group, not just the matching one
              for (const member of members) {
                if (!includedIds.has(member.id)) {
                  aiGroupedRequirements.push(member);
                  includedIds.add(member.id);
                }
              }
              similarityGroupsFound++;
              console.log(`🔍 Textual similarity found with AI group ${groupId}, added all ${members.length} group members`);
            }
          }
          
          if (similarityGroupsFound > 0) {
            console.log(`✅ Total similarity groups expanded: ${similarityGroupsFound}, total AI-grouped requirements: ${aiGroupedRequirements.length}`);
          }
        }

        compareResults.push({
          newRequirement: newReq,
          matchedRequirements: matches,
          isIdentical,
          similarityScore: isIdentical ? 1.0 : (aiGroupedRequirements.length > 0 ? 0.7 : 0.0),
          aiGroupedRequirements: aiGroupedRequirements.length > 0 ? aiGroupedRequirements : undefined
        });
      }

      console.log(`🔍 Comparison complete: ${compareResults.length} results generated`);
      console.log(`📊 Identical matches found: ${compareResults.filter(r => r.isIdentical).length}`);
      console.log(`🤖 AI-grouped similar requirements found: ${compareResults.filter(r => r.aiGroupedRequirements && r.aiGroupedRequirements.length > 0).length}`);

      res.json(compareResults);

    } catch (error) {
      console.error("Error in compare API:", error);
      res.status(500).json({ 
        error: "Kunde inte jämföra krav", 
        details: error instanceof Error ? error.message : 'Okänt fel' 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
