import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import { storage } from "./storage";
import { extractContractData, answerContractQuery } from "./openai";
import { insertContractSchema, insertQuerySchema } from "@shared/schema";

// Use createRequire for CommonJS modules  
const require = createRequire(import.meta.url);
// pdf-parse v1 uses function-based API
const pdfParse = require("pdf-parse");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload and analyze contract
  app.post("/api/contracts/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse PDF using pdf-parse v1 API
      let pdfData;
      let fullText;
      
      try {
        pdfData = await pdfParse(req.file.buffer);
        fullText = pdfData.text;
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        return res.status(400).json({ 
          error: "Failed to parse PDF file. Please ensure the file is a valid PDF document." 
        });
      }

      if (!fullText || fullText.trim().length === 0) {
        return res.status(400).json({ error: "Could not extract text from PDF" });
      }

      // Extract data using AI
      const extractedData = await extractContractData(fullText);

      // Validate and save to storage using schema
      const contractData = insertContractSchema.parse({
        fileName: req.file.originalname,
        fileSize: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
        fullText,
        extractedData,
      });

      const contract = await storage.createContract(contractData);

      res.json(contract);
    } catch (error) {
      console.error("Error processing contract:", error);
      
      // Check if this is a PDF parsing error that escaped the inner catch
      if (error instanceof Error && 
          (error.message.includes("PDF") || 
           error.message.includes("FormatError") ||
           error.message.includes("Command token") ||
           error.name === "FormatError")) {
        return res.status(400).json({
          error: "Failed to parse PDF file. Please ensure the file is a valid PDF document."
        });
      }
      
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to process contract",
      });
    }
  });

  // Get all contracts
  app.get("/api/contracts", async (req, res) => {
    try {
      const contracts = await storage.getAllContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  // Get single contract
  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  // Delete contract
  app.delete("/api/contracts/:id", async (req, res) => {
    try {
      await storage.deleteContract(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ error: "Failed to delete contract" });
    }
  });

  // Query contract
  app.post("/api/contracts/:id/query", async (req, res) => {
    try {
      // Validate request body
      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({ error: "Invalid request body" });
      }

      const { question } = req.body;
      
      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return res.status(400).json({ error: "Question is required and must be a non-empty string" });
      }

      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }

      if (!contract.fullText) {
        return res.status(400).json({ error: "Contract text not available" });
      }

      // Get answer from AI
      const { answer, source } = await answerContractQuery(
        contract.fullText,
        question
      );

      // Validate and save query using schema
      const queryData = insertQuerySchema.parse({
        contractId: req.params.id,
        question: question.trim(),
        answer,
        source,
      });

      const query = await storage.createQuery(queryData);

      res.json(query);
    } catch (error) {
      console.error("Error processing query:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to process query",
      });
    }
  });

  // Get queries for contract
  app.get("/api/contracts/:id/queries", async (req, res) => {
    try {
      const queries = await storage.getQueriesByContract(req.params.id);
      res.json(queries);
    } catch (error) {
      console.error("Error fetching queries:", error);
      res.status(500).json({ error: "Failed to fetch queries" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
