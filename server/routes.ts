import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as pdfParse from "pdf-parse";
import { storage } from "./storage";
import { extractContractData, answerContractQuery } from "./openai";
import { insertContractSchema, insertQuerySchema } from "@shared/schema";

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

      // Parse PDF
      const pdfData = await pdfParse(req.file.buffer);
      const fullText = pdfData.text;

      // Extract data using AI
      const extractedData = await extractContractData(fullText);

      // Save to storage
      const contract = await storage.createContract({
        fileName: req.file.originalname,
        fileSize: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
        fullText,
        extractedData,
      });

      res.json(contract);
    } catch (error) {
      console.error("Error processing contract:", error);
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
      const { question } = req.body;
      
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Question is required" });
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

      // Save query
      const query = await storage.createQuery({
        contractId: req.params.id,
        question,
        answer,
        source,
      });

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
