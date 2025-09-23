import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openaiService } from "./openai-service";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";
import { uploadExcelSchema, filterSchema, type InsertRequirement } from "@shared/schema";
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

      // Process each sheet (except the first one)
      for (const sheetName of sheetsToProcess) {
        console.log(`\n=== Processing sheet: ${sheetName} ===`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          console.log(`Skipping sheet ${sheetName} - too few rows`);
          continue;
        }

        allJsonData = allJsonData.concat(jsonData);
      }

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

      // Process requirements from Excel data
      const requirements: InsertRequirement[] = [];
      const importDate = new Date().toISOString().split('T')[0];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
          continue; // Skip empty rows
        }

        // Extract requirement text (assume first non-empty column contains the requirement)
        let requirementText = '';
        let requirementType = '';
        let category = '';

        for (let j = 0; j < row.length && j < headers.length; j++) {
          const header = headers[j]?.toString().toLowerCase().trim() || '';
          const value = row[j]?.toString().trim() || '';

          if (!value) continue;

          // More flexible requirement text identification
          const isRequirementColumn = 
            header.includes('krav') || 
            header.includes('text') || 
            header.includes('beskrivning') ||
            header.includes('innehåll') ||
            header.includes('specifikation') ||
            header.includes('funktion') ||
            header.includes('requirement') ||
            header.includes('description') ||
            header.includes('spec') ||
            header === 'a' || // Sometimes Excel uses simple letter headers
            header === 'b' ||
            j === 0 || // Fallback to first column
            (j < 3 && value.length > 20); // Assume longer text in first few columns might be requirements

          if (isRequirementColumn && !requirementText && value.length > 5) {
            requirementText = value;
          }

          // More flexible requirement type identification  
          const isTypeColumn = 
            header.includes('typ') || 
            header.includes('type') || 
            header.includes('skall') || 
            header.includes('bör') ||
            header.includes('shall') ||
            header.includes('should') ||
            header.includes('must') ||
            header.includes('obligatorisk') ||
            header.includes('frivillig');

          if (isTypeColumn) {
            const lowerValue = value.toLowerCase();
            if (lowerValue.includes('skall') || lowerValue.includes('ska') || lowerValue.includes('must') || lowerValue.includes('shall')) {
              requirementType = 'Skall';
            } else if (lowerValue.includes('bör') || lowerValue.includes('should') || lowerValue.includes('önskas')) {
              requirementType = 'Bör';
            }
          }

          // More flexible category identification
          const isCategoryColumn = 
            header.includes('kategori') || 
            header.includes('category') || 
            header.includes('grupp') ||
            header.includes('område') ||
            header.includes('domän') ||
            header.includes('typ') ||
            header.includes('ämne') ||
            header.includes('subject') ||
            header.includes('topic');

          if (isCategoryColumn && !category && value.length > 0) {
            category = value;
          }
        }

        // OBLIGATORISKT KRAV: En rad måste innehålla "ska" eller "bör" för att räknas som giltigt krav
        let hasRequiredKeyword = false;
        const fullRowText = row.join(' ').toLowerCase();
        
        if (fullRowText.includes('ska') || 
            fullRowText.includes('skall') || 
            fullRowText.includes('bör') || 
            fullRowText.includes('shall') || 
            fullRowText.includes('should') ||
            fullRowText.includes('must')) {
          hasRequiredKeyword = true;
        }

        if (requirementText && hasRequiredKeyword) {
          console.log('✅ Valid requirement found:', requirementText.substring(0, 100) + '...');
          const requirement: InsertRequirement = {
            id: randomUUID(),
            text: requirementText,
            import_organization: metadata.data.organization,
            import_date: importDate,
            requirement_type: requirementType || null,
            requirement_category: category || null,
            organizations: [metadata.data.organization],
            categories: category ? [category] : [],
            is_new: true,
            user_status: 'OK',
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
        } else if (requirementText && !hasRequiredKeyword) {
          console.log('❌ Row rejected - missing "ska"/"bör":', requirementText.substring(0, 100) + '...');
        } else if (!requirementText) {
          console.log('❌ Row rejected - no requirement text found');
        }
      }

      if (requirements.length === 0) {
        return res.status(400).json({ error: "Inga giltiga krav hittades i Excel-filen" });
      }

      // Save requirements to database
      const savedRequirements = await storage.createManyRequirements(requirements);

      res.json({
        success: true,
        totalRequirements: savedRequirements.length,
        newRequirements: savedRequirements.length,
        duplicates: 0,
        organization: metadata.data.organization,
        categories: Array.from(new Set(requirements.map(r => r.requirement_category).filter(Boolean))),
        processingTime: Date.now() - req.body.startTime || 0,
        aiGroupsFound: 0
      });

    } catch (error) {
      console.error("Error importing Excel file:", error);
      res.status(500).json({ 
        error: "Kunde inte importera Excel-fil", 
        details: error instanceof Error ? error.message : 'Okänt fel' 
      });
    }
  });

  // AI Grouping API 
  app.get("/api/requirements/grouping", async (req, res) => {
    try {
      const requirements = await storage.getRequirementsForGrouping();
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching requirements for grouping:", error);
      res.status(500).json({ error: "Kunde inte hämta krav för gruppering" });
    }
  });

  app.post("/api/requirements/grouping", async (req, res) => {
    try {
      // Get all requirements for grouping
      const requirements = await storage.getRequirementsForGrouping();
      
      if (requirements.length === 0) {
        return res.json({ 
          success: true, 
          message: "Inga krav att gruppera",
          groups: [], 
          summary: "Inga krav fanns tillgängliga för gruppering." 
        });
      }

      // Perform AI-based grouping
      console.log(`Starting AI grouping for ${requirements.length} requirements...`);
      const groupingResult = await openaiService.groupRequirements(requirements);

      // Clear all existing groupings first
      console.log("Clearing existing groupings...");
      await storage.clearAllGroupings();

      // Update database with new grouping results
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

      // Explicitly clear ungrouped requirements (already cleared above, but for clarity)
      for (const ungroupedId of groupingResult.ungroupedRequirements) {
        await storage.clearRequirementGrouping(ungroupedId);
      }

      // Generate summary
      const summary = await openaiService.generateGroupingSummary(
        groupingResult.groups, 
        requirements.length
      );

      console.log(`AI grouping completed: ${groupingResult.groups.length} groups, ${updatedCount} requirements updated`);

      res.json({
        success: true,
        message: "AI-gruppering slutförd",
        groups: groupingResult.groups,
        totalRequirements: requirements.length,
        groupedRequirements: groupingResult.groups.reduce((sum, g) => sum + g.members.length, 0),
        ungroupedRequirements: groupingResult.ungroupedRequirements.length,
        summary: summary
      });

    } catch (error) {
      console.error("Error performing AI grouping:", error);
      res.status(500).json({ 
        error: "Kunde inte utföra AI-gruppering", 
        details: error instanceof Error ? error.message : 'Okänt fel' 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
