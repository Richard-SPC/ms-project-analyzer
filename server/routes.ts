import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { parseMppFile, getProjectNameFromFileName } from "./mppParser";
import { 
  insertProjectSchema, 
  insertTaskSchema, 
  insertDcmaAssessmentSchema, 
  insertNecComplianceSchema 
} from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for project files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const isXml = file.mimetype === "text/xml" || file.mimetype === "application/xml" || file.originalname.endsWith(".xml");
    const isMpp = file.mimetype === "application/vnd.ms-project" || file.originalname.endsWith(".mpp");
    
    if (isXml || isMpp) {
      cb(null, true);
    } else {
      cb(new Error("Only XML and MPP files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Project routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create project" 
      });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(parseInt(req.params.id), req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to update project" 
      });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Task routes
  app.get("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksByProject(parseInt(req.params.projectId));
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create task" 
      });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.updateTask(parseInt(req.params.id), req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to update task" 
      });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await storage.deleteTask(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // DCMA Assessment routes
  app.get("/api/dcma-assessments", async (req, res) => {
    try {
      // Get all assessments across all projects
      const allProjects = await storage.getAllProjects();
      const allAssessments = [];
      
      for (const project of allProjects) {
        const assessments = await storage.getDcmaAssessmentsByProject(project.id);
        allAssessments.push(...assessments);
      }
      
      // Sort by assessment date, newest first
      allAssessments.sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
      
      res.json(allAssessments);
    } catch (error) {
      console.error("Error fetching all DCMA assessments:", error);
      res.status(500).json({ error: "Failed to fetch DCMA assessments" });
    }
  });

  app.get("/api/projects/:projectId/dcma-assessments", async (req, res) => {
    try {
      const assessments = await storage.getDcmaAssessmentsByProject(parseInt(req.params.projectId));
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching DCMA assessments:", error);
      res.status(500).json({ error: "Failed to fetch DCMA assessments" });
    }
  });

  app.get("/api/projects/:projectId/dcma-assessments/latest", async (req, res) => {
    try {
      const assessment = await storage.getLatestDcmaAssessment(parseInt(req.params.projectId));
      if (!assessment) {
        return res.status(404).json({ error: "No DCMA assessment found" });
      }
      res.json(assessment);
    } catch (error) {
      console.error("Error fetching latest DCMA assessment:", error);
      res.status(500).json({ error: "Failed to fetch latest DCMA assessment" });
    }
  });

  app.post("/api/dcma-assessments", async (req, res) => {
    try {
      const assessmentData = insertDcmaAssessmentSchema.parse(req.body);
      const assessment = await storage.createDcmaAssessment(assessmentData);
      res.json(assessment);
    } catch (error) {
      console.error("Error creating DCMA assessment:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create DCMA assessment" 
      });
    }
  });

  // NEC Compliance routes
  app.get("/api/nec-compliance", async (req, res) => {
    try {
      // Get all compliance checks across all projects
      const allProjects = await storage.getAllProjects();
      const allCompliances = [];
      
      for (const project of allProjects) {
        const compliances = await storage.getNecComplianceByProject(project.id);
        allCompliances.push(...compliances);
      }
      
      // Sort by assessment date, newest first
      allCompliances.sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
      
      res.json(allCompliances);
    } catch (error) {
      console.error("Error fetching all NEC compliance checks:", error);
      res.status(500).json({ error: "Failed to fetch NEC compliance checks" });
    }
  });

  app.get("/api/projects/:projectId/nec-compliance", async (req, res) => {
    try {
      const compliances = await storage.getNecComplianceByProject(parseInt(req.params.projectId));
      res.json(compliances);
    } catch (error) {
      console.error("Error fetching NEC compliance:", error);
      res.status(500).json({ error: "Failed to fetch NEC compliance" });
    }
  });

  app.get("/api/projects/:projectId/nec-compliance/latest", async (req, res) => {
    try {
      const compliance = await storage.getLatestNecCompliance(parseInt(req.params.projectId));
      if (!compliance) {
        return res.status(404).json({ error: "No NEC compliance check found" });
      }
      res.json(compliance);
    } catch (error) {
      console.error("Error fetching latest NEC compliance:", error);
      res.status(500).json({ error: "Failed to fetch latest NEC compliance" });
    }
  });

  app.post("/api/nec-compliance", async (req, res) => {
    try {
      const complianceData = insertNecComplianceSchema.parse(req.body);
      const compliance = await storage.createNecCompliance(complianceData);
      res.json(compliance);
    } catch (error) {
      console.error("Error creating NEC compliance:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create NEC compliance check" 
      });
    }
  });

  // File upload route for Microsoft Project files (XML and MPP)
  app.post("/api/projects/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileName = req.file.originalname;
      const isMpp = fileName.toLowerCase().endsWith('.mpp');
      const isXml = fileName.toLowerCase().endsWith('.xml');

      if (isMpp) {
        // Handle MPP file
        const result = await parseMppFile(req.file.buffer, fileName);
        
        if (!result.success) {
          return res.status(400).json({ 
            error: result.message,
            fileName: result.fileName,
            fileSize: result.fileSize,
            requiresConversion: true
          });
        }

        // If we successfully parsed (future enhancement), create project
        res.json(result);
      } else if (isXml) {
        // Handle XML file
        const xmlContent = req.file.buffer.toString('utf-8');
        
        // Basic XML validation
        if (!xmlContent.includes('<?xml')) {
          return res.status(400).json({ error: "Invalid XML file" });
        }

        // Parse basic project info from XML (simplified - can be enhanced later)
        const projectName = getProjectNameFromFileName(fileName);
        
        res.json({ 
          success: true, 
          fileName: req.file.originalname,
          projectName,
          xmlContent 
        });
      } else {
        return res.status(400).json({ 
          error: "Unsupported file format. Please upload XML or MPP files." 
        });
      }
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process file" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
