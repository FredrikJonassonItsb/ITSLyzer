import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ error: "Excel-filen innehåller inga kalkylblad" });
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        return res.status(400).json({ error: "Excel-filen måste innehålla minst en rubrikrad och en datarad" });
      }

      // Extract headers and data
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1) as any[][];

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
          const header = headers[j]?.toString().toLowerCase() || '';
          const value = row[j]?.toString().trim() || '';

          if (!value) continue;

          // Identify requirement text
          if (header.includes('krav') || header.includes('text') || header.includes('beskrivning') || j === 0) {
            if (!requirementText) requirementText = value;
          }

          // Identify requirement type (Skall/Bör)
          if (header.includes('typ') || header.includes('type') || header.includes('skall') || header.includes('bör')) {
            if (value.toLowerCase().includes('skall')) requirementType = 'Skall';
            else if (value.toLowerCase().includes('bör')) requirementType = 'Bör';
          }

          // Identify category
          if (header.includes('kategori') || header.includes('category') || header.includes('grupp')) {
            category = value;
          }
        }

        if (requirementText) {
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
      // This will be implemented in the AI grouping task
      res.status(501).json({ error: "AI-gruppering är inte implementerad än" });
    } catch (error) {
      console.error("Error performing AI grouping:", error);
      res.status(500).json({ error: "Kunde inte utföra AI-gruppering" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
