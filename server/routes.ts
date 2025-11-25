import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { parseMppFile, getProjectNameFromFileName } from "./mppParser";
import { parseProjectXml } from "./xmlParser";
import { parseExcelFile } from "./excelParser";
import { analyzeDcmaCompliance } from "./dcmaAnalyzer";
import { analyzeNecCompliance } from "./necAnalyzer";
import { 
  insertProjectSchema, 
  insertTaskSchema, 
  insertDcmaAssessmentSchema, 
  insertNecComplianceSchema,
  insertWorkspaceSchema
} from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for project files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const isXml = file.mimetype === "text/xml" || file.mimetype === "application/xml" || file.originalname.endsWith(".xml");
    const isMpp = file.mimetype === "application/vnd.ms-project" || file.originalname.endsWith(".mpp");
    const isExcel = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.originalname.endsWith(".xlsx");
    const isCsv = file.mimetype === "text/csv" || file.originalname.endsWith(".csv");
    
    if (isXml || isMpp || isExcel || isCsv) {
      cb(null, true);
    } else {
      cb(new Error("Only XML, MPP, Excel (.xlsx), and CSV files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Workspace routes
  app.get("/api/workspaces", async (req, res) => {
    try {
      const workspaces = await storage.getAllWorkspaces();
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:id", async (req, res) => {
    try {
      const workspace = await storage.getWorkspace(parseInt(req.params.id));
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error) {
      console.error("Error fetching workspace:", error);
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.post("/api/workspaces", async (req, res) => {
    try {
      const workspaceData = insertWorkspaceSchema.parse(req.body);
      const workspace = await storage.createWorkspace(workspaceData);
      res.json(workspace);
    } catch (error) {
      console.error("Error creating workspace:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create workspace" 
      });
    }
  });

  app.patch("/api/workspaces/:id", async (req, res) => {
    try {
      const workspace = await storage.updateWorkspace(parseInt(req.params.id), req.body);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error) {
      console.error("Error updating workspace:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to update workspace" 
      });
    }
  });

  app.delete("/api/workspaces/:id", async (req, res) => {
    try {
      await storage.deleteWorkspace(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workspace:", error);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  app.get("/api/workspaces/:id/projects", async (req, res) => {
    try {
      const projects = await storage.getProjectsByWorkspace(parseInt(req.params.id));
      res.json(projects);
    } catch (error) {
      console.error("Error fetching workspace projects:", error);
      res.status(500).json({ error: "Failed to fetch workspace projects" });
    }
  });

  app.get("/api/projects/unassigned", async (req, res) => {
    try {
      const projects = await storage.getUnassignedProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching unassigned projects:", error);
      res.status(500).json({ error: "Failed to fetch unassigned projects" });
    }
  });

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

  app.post("/api/projects/:projectId/tasks", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Ensure the project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Add projectId to the request body if not present
      const taskData = insertTaskSchema.parse({
        ...req.body,
        projectId: projectId
      });
      
      const task = await storage.createTask(taskData);
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create task" 
      });
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

  // Run automated DCMA analysis on a project
  app.get("/api/projects/:projectId/dcma-analysis", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Get project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get all tasks for the project
      const tasks = await storage.getTasksByProject(projectId);
      
      // Run automated analysis
      const analysisResult = analyzeDcmaCompliance(project, tasks);
      
      res.json(analysisResult);
    } catch (error) {
      console.error("Error running DCMA analysis:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to run DCMA analysis" 
      });
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

  app.patch("/api/dcma-assessments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertDcmaAssessmentSchema.partial().parse(req.body);
      
      // Update the assessment
      const updated = await storage.updateDcmaAssessment(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      
      // Recompute overall score based on effective pass/fail (original || override)
      const effectiveScore = [
        updated.missingLogic || updated.missingLogicOverride,
        updated.negativeLag || updated.negativeLagOverride,
        updated.leadsLags || updated.leadsLagsOverride,
        updated.relationshipTypes || updated.relationshipTypesOverride,
        updated.hardConstraints || updated.hardConstraintsOverride,
        updated.largeFloat || updated.largeFloatOverride,
        updated.negativeFloat || updated.negativeFloatOverride,
        updated.largeDurations || updated.largeDurationsOverride,
        updated.invalidTasks || updated.invalidTasksOverride,
        updated.resourcesAssigned || updated.resourcesAssignedOverride,
        updated.lateTasks || updated.lateTasksOverride,
        updated.criticalPathTest || updated.criticalPathTestOverride,
        updated.criticalPathLength || updated.criticalPathLengthOverride,
        updated.baselineExecutionIndex || updated.baselineExecutionIndexOverride,
      ].filter(Boolean).length;
      
      // Update score and passed status
      const finalUpdate = await storage.updateDcmaAssessment(id, {
        overallScore: effectiveScore,
        passed: effectiveScore >= 10, // Assuming 10/14 threshold
      });
      
      res.json(finalUpdate);
    } catch (error) {
      console.error("Error updating DCMA assessment:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to update DCMA assessment" 
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

  // Run automated NEC compliance analysis on a project
  app.get("/api/projects/:projectId/nec-analysis", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Get project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get all tasks for the project
      const tasks = await storage.getTasksByProject(projectId);
      
      // Run automated analysis
      const analysisResult = analyzeNecCompliance(project, tasks);
      
      res.json(analysisResult);
    } catch (error) {
      console.error("Error running NEC analysis:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to run NEC analysis" 
      });
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

  // File upload route for Microsoft Project files (XML, MPP, Excel, CSV)
  app.post("/api/projects/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileName = req.file.originalname;
      const isMpp = fileName.toLowerCase().endsWith('.mpp');
      const isXml = fileName.toLowerCase().endsWith('.xml');
      const isExcel = fileName.toLowerCase().endsWith('.xlsx');
      const isCsv = fileName.toLowerCase().endsWith('.csv');

      if (isExcel || isCsv) {
        // Handle Excel/CSV file
        console.log(`Parsing Excel/CSV file: ${fileName}`);
        
        // Write buffer to temporary file for xlsx library
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${fileName}`);
        
        try {
          fs.writeFileSync(tempFilePath, req.file.buffer);
          
          const result = await parseExcelFile(tempFilePath, fileName);
          
          // Clean up temp file
          fs.unlinkSync(tempFilePath);
          
          if (!result.success || !result.project) {
            console.error("Excel parsing failed:", result.error);
            return res.status(400).json({ 
              success: false,
              error: result.error || "Failed to parse Excel file",
              fileName: fileName,
            });
          }
          
          console.log(`Excel parsed successfully: ${result.tasks?.length || 0} tasks found`);

          // Create the project in the database
          const createdProject = await storage.createProject(result.project);
          
          // Create tasks linked to the project
          const createdTasks = [];
          if (result.tasks) {
            for (const task of result.tasks) {
              const taskWithProject = { ...task, projectId: createdProject.id };
              const createdTask = await storage.createTask(taskWithProject);
              createdTasks.push(createdTask);
            }
          }
          
          res.json({ 
            success: true, 
            fileName: req.file.originalname,
            project: createdProject,
            tasksCreated: createdTasks.length,
            message: `Successfully imported project "${createdProject.name}" with ${createdTasks.length} tasks from Excel file`
          });
        } catch (error) {
          // Clean up temp file on error
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          throw error;
        }
      } else if (isMpp) {
        // Handle MPP file using MPXJ Python parser
        console.log(`Parsing MPP file: ${fileName}`);
        const result = await parseMppFile(req.file.buffer, fileName);
        
        if (!result.success || !result.project) {
          console.error("MPP parsing failed:", JSON.stringify(result, null, 2));
          return res.status(400).json({ 
            success: false,
            error: result.message || "Failed to parse MPP file",
            fileName: result.fileName,
            fileSize: result.fileSize,
          });
        }
        
        console.log(`MPP parsed successfully: ${result.tasks?.length || 0} tasks found`);

        // Create the project in the database
        const createdProject = await storage.createProject(result.project);
        
        // Create tasks linked to the project
        const createdTasks = [];
        if (result.tasks) {
          for (const task of result.tasks) {
            const taskWithProject = { ...task, projectId: createdProject.id };
            const createdTask = await storage.createTask(taskWithProject);
            createdTasks.push(createdTask);
          }
        }
        
        res.json({ 
          success: true, 
          fileName: req.file.originalname,
          project: createdProject,
          tasksCreated: createdTasks.length,
          message: `Successfully imported project "${createdProject.name}" with ${createdTasks.length} tasks from MPP file`
        });
      } else if (isXml) {
        // Handle XML file
        const xmlContent = req.file.buffer.toString('utf-8');
        
        // Basic XML validation
        if (!xmlContent.includes('<?xml')) {
          return res.status(400).json({ error: "Invalid XML file" });
        }

        try {
          // Parse Microsoft Project XML
          const parsedData = await parseProjectXml(xmlContent, fileName);
          
          // Create the project in the database
          const createdProject = await storage.createProject(parsedData.project);
          
          // First pass: Create all tasks and build UID -> database ID mapping
          const uidToDbId = new Map<string, number>();
          const createdTasks = [];
          
          for (const task of parsedData.tasks) {
            // Create task without predecessors first (we'll update them in second pass)
            const { uid, predecessors, ...taskData } = task as any;
            const taskWithProject = { 
              ...taskData, 
              projectId: createdProject.id,
              predecessors: undefined // Clear predecessors for now
            };
            const createdTask = await storage.createTask(taskWithProject);
            createdTasks.push(createdTask);
            
            // Map MS Project UID to database ID
            if (uid) {
              uidToDbId.set(uid, createdTask.id);
            }
          }
          
          // Second pass: Update predecessors with correct database IDs
          for (let i = 0; i < parsedData.tasks.length; i++) {
            const parsedTask = parsedData.tasks[i] as any;
            const createdTask = createdTasks[i];
            
            if (parsedTask.predecessors && parsedTask.predecessors.length > 0) {
              // Convert MS Project UIDs to database IDs
              // Format: "UID|Type|Lag" (e.g., "4322|FS|2" or "456|SS|-5")
              const dbPredecessors: string[] = [];
              for (const predStr of parsedTask.predecessors) {
                // Check for new pipe-delimited format
                if (predStr.includes('|')) {
                  const parts = predStr.split('|');
                  if (parts.length === 3) {
                    const uid = parts[0];
                    const type = parts[1];
                    const lag = parts[2];
                    
                    const dbId = uidToDbId.get(uid);
                    if (dbId !== undefined) {
                      // Rebuild with database ID
                      dbPredecessors.push(`${dbId}|${type}|${lag}`);
                    }
                  }
                } else {
                  // Legacy format - just UID or dash-delimited
                  const parts = predStr.split('-');
                  if (parts.length >= 2) {
                    const uid = parts[0];
                    const typeAndLag = parts.slice(1).join('-');
                    
                    const dbId = uidToDbId.get(uid);
                    if (dbId !== undefined) {
                      dbPredecessors.push(`${dbId}-${typeAndLag}`);
                    }
                  } else {
                    const dbId = uidToDbId.get(predStr);
                    if (dbId !== undefined) {
                      dbPredecessors.push(dbId.toString());
                    }
                  }
                }
              }
              
              // Update task with converted predecessors
              if (dbPredecessors.length > 0) {
                await storage.updateTask(createdTask.id, { 
                  predecessors: dbPredecessors 
                });
              }
            }
          }
          
          res.json({ 
            success: true, 
            fileName: req.file.originalname,
            project: createdProject,
            tasksCreated: createdTasks.length,
            message: `Successfully imported project "${createdProject.name}" with ${createdTasks.length} tasks`
          });
        } catch (parseError) {
          console.error("Error parsing XML:", parseError);
          return res.status(400).json({ 
            error: parseError instanceof Error ? parseError.message : "Failed to parse XML file" 
          });
        }
      } else {
        return res.status(400).json({ 
          error: "Unsupported file format. Please upload XML, MPP, Excel (.xlsx), or CSV files." 
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
