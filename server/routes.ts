import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { parseMppFile, getProjectNameFromFileName } from "./mppParser";
import { parseProjectXml } from "./xmlParser";
import { parseExcelFile } from "./excelParser";
import { analyzeDcmaCompliance } from "./dcmaAnalyser";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertDcmaAssessmentSchema,
  insertWorkspaceSchema,
  insertCalendarExceptionSchema,
  insertUserSchema,
} from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

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

// Simple in-memory session store
const sessions = new Map<string, { userId: number; expires: Date }>();
const SESSION_SECRET = process.env.SESSION_SECRET || "synergy-dashboard-secret-key";

function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

function setSessionCookie(res: any, sessionId: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  res.setHeader("Set-Cookie", `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`);
  return expires;
}

function getSessionId(req: any): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/sessionId=([^;]+)/);
  return match ? match[1] : undefined;
}

async function getCurrentUser(req: any): Promise<{ id: number; username: string; name: string | null; role: string } | undefined> {
  const sessionId = getSessionId(req);
  if (!sessionId) return undefined;
  const session = sessions.get(sessionId);
  if (!session || session.expires < new Date()) {
    sessions.delete(sessionId);
    return undefined;
  }
  const user = await storage.getUser(session.userId);
  if (!user) return undefined;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });
      const sessionId = generateSessionId();
      const expires = setSessionCookie(res, sessionId);
      sessions.set(sessionId, { userId: user.id, expires });
      res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register user" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const sessionId = generateSessionId();
      const expires = setSessionCookie(res, sessionId);
      sessions.set(sessionId, { userId: user.id, expires });
      res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/logout", async (req, res) => {
    const sessionId = getSessionId(req);
    if (sessionId) sessions.delete(sessionId);
    res.setHeader("Set-Cookie", "sessionId=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
    res.json({ success: true });
  });

  app.get("/api/user", async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // User management routes (admin)
  app.get("/api/users", async (req, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: "Not authenticated" });
      const allUsers = await storage.getAllUsers();
      // Never return passwords
      const safeUsers = allUsers.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: "Not authenticated" });
      const { username, password, name, role } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username and password required" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ error: "Username already exists" });
      const hashed = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashed, name: name || null, role: role || "user" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: "Not authenticated" });
      const id = parseInt(req.params.id);
      const { name, role, username } = req.body;
      const updates: Record<string, string> = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (username !== undefined) {
        // Check uniqueness
        const existing = await storage.getUserByUsername(username);
        if (existing && existing.id !== id) return res.status(400).json({ error: "Username already taken" });
        updates.username = username;
      }
      const updated = await storage.updateUser(id, updates);
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update user" });
    }
  });

  app.post("/api/users/:id/change-password", async (req, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: "Not authenticated" });
      const id = parseInt(req.params.id);
      const { newPassword, currentPassword } = req.body;
      if (!newPassword) return res.status(400).json({ error: "New password required" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      // If changing own password, require current password
      if (currentUser.id === id) {
        if (!currentPassword) return res.status(400).json({ error: "Current password required" });
        const user = await storage.getUser(id);
        if (!user || !(await comparePasswords(currentPassword, user.password))) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }
      const hashed = await hashPassword(newPassword);
      const updated = await storage.updateUser(id, { password: hashed });
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to change password" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ error: "Not authenticated" });
      const id = parseInt(req.params.id);
      if (currentUser.id === id) return res.status(400).json({ error: "Cannot delete your own account" });
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

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

  app.get("/api/projects/:id/completion", async (req, res) => {
    try {
      const tasks = await storage.getTasksByProject(parseInt(req.params.id));
      
      if (tasks.length === 0) {
        return res.json({ percentComplete: 0 });
      }
      
      // Filter out summary tasks - only calculate completion for actual work tasks
      const workTasks = tasks.filter(t => !t.isSummary);
      
      if (workTasks.length === 0) {
        return res.json({ percentComplete: 0 });
      }
      
      // Calculate duration-weighted percent complete
      const totalDuration = workTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
      
      if (totalDuration === 0) {
        return res.json({ percentComplete: 0 });
      }
      
      const completedDuration = workTasks.reduce((sum, task) => {
        const percent = parseFloat(task.percentComplete?.toString() || "0");
        return sum + ((task.duration || 0) * (percent / 100));
      }, 0);
      
      const percentComplete = Math.round((completedDuration / totalDuration) * 100);
      
      res.json({ percentComplete });
    } catch (error) {
      console.error("Error calculating project completion:", error);
      res.status(500).json({ error: "Failed to calculate project completion" });
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

  // Procurement tasks route
  app.get("/api/procurement-tasks", async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      const procurementTasks: Array<{ id: number; name: string; duration: number | null; percentComplete: number; projectId: number; projectName: string }> = [];
      
      for (const project of allProjects) {
        const tasks = await storage.getTasksByProject(project.id);
        
        // Find all "Procurement Summary" tasks
        const procurementSummaryTasks = tasks.filter(t => 
          t.name.toLowerCase().includes("procurement summary")
        );
        
        // Get WBS prefixes for Procurement Summary tasks
        const procurementSummaryPrefixes = procurementSummaryTasks
          .filter(t => t.wbsCode)
          .map(t => t.wbsCode);
        
        // Find all "Design" tasks to exclude procurement items under Design
        const designTasks = tasks.filter(t => 
          t.name.toLowerCase().includes("design")
        );
        
        // Get WBS prefixes for Design tasks
        const designPrefixes = designTasks
          .filter(t => t.wbsCode)
          .map(t => t.wbsCode);
        
        // Filter for procurement tasks that are children of Procurement Summary
        const procurement = tasks
          .filter(task => {
            if (task.isSummary || !task.name.toLowerCase().includes("procurement")) {
              return false;
            }
            
            // Exclude if under Design WBS
            if (task.wbsCode && designPrefixes.length > 0) {
              const isUnderDesign = designPrefixes.some(prefix => 
                task.wbsCode?.startsWith(prefix + ".") || task.wbsCode === prefix
              );
              if (isUnderDesign) return false;
            }
            
            // If there are Procurement Summary tasks, only include children of those
            if (procurementSummaryPrefixes.length > 0) {
              if (!task.wbsCode) return false;
              return procurementSummaryPrefixes.some(prefix => 
                task.wbsCode?.startsWith(prefix + ".") || task.wbsCode === prefix
              );
            }
            
            // If there are NO Procurement Summary tasks, include all procurement tasks
            // (for projects that might have different structure)
            return true;
          })
          .map(task => ({
            id: task.id,
            name: task.name,
            duration: task.duration,
            percentComplete: parseFloat(task.percentComplete?.toString() || "0"),
            projectId: project.id,
            projectName: project.name
          }));
        procurementTasks.push(...procurement);
      }
      
      // Sort by project name, then task name
      procurementTasks.sort((a, b) => {
        if (a.projectName !== b.projectName) {
          return a.projectName.localeCompare(b.projectName);
        }
        return a.name.localeCompare(b.name);
      });
      
      res.json(procurementTasks);
    } catch (error) {
      console.error("Error fetching procurement tasks:", error);
      res.status(500).json({ error: "Failed to fetch procurement tasks" });
    }
  });

  // Live procurement dates route - latest version per project
  app.get("/api/live-procurement-dates", async (req, res) => {
    try {
      const allWorkspaces = await storage.getAllWorkspaces();
      const liveProcurementData: Array<{
        id: number;
        name: string;
        startDate: Date | null;
        endDate: Date | null;
        duration: number | null;
        percentComplete: number;
        projectId: number;
        projectName: string;
        workspaceName: string;
        client: string | undefined;
        status: string | undefined;
      }> = [];

      for (const workspace of allWorkspaces) {
        const workspaceProjects = await storage.getProjectsByWorkspace(workspace.id);
        
        // Find latest project by statusDate
        if (workspaceProjects.length === 0) continue;
        const latestProject = workspaceProjects.reduce((latest, current) => {
          const latestDate = latest.statusDate ? new Date(latest.statusDate).getTime() : 0;
          const currentDate = current.statusDate ? new Date(current.statusDate).getTime() : 0;
          return currentDate > latestDate ? current : latest;
        });

        const tasks = await storage.getTasksByProject(latestProject.id);
        
        // Find all "Procurement Summary" tasks
        const procurementSummaryTasks = tasks.filter(t => 
          t.name.toLowerCase().includes("procurement summary")
        );
        
        // Get WBS prefixes for Procurement Summary tasks
        const procurementSummaryPrefixes = procurementSummaryTasks
          .filter(t => t.wbsCode)
          .map(t => t.wbsCode);
        
        // Find all "Design" tasks to exclude procurement items under Design
        const designTasks = tasks.filter(t => 
          t.name.toLowerCase().includes("design")
        );
        
        // Get WBS prefixes for Design tasks
        const designPrefixes = designTasks
          .filter(t => t.wbsCode)
          .map(t => t.wbsCode);
        
        // Filter for procurement tasks that are children of Procurement Summary
        const procurement = tasks
          .filter(task => {
            if (task.isSummary || !task.name.toLowerCase().includes("procurement")) {
              return false;
            }
            
            // Exclude if under Design WBS
            if (task.wbsCode && designPrefixes.length > 0) {
              const isUnderDesign = designPrefixes.some(prefix => 
                task.wbsCode?.startsWith(prefix + ".") || task.wbsCode === prefix
              );
              if (isUnderDesign) return false;
            }
            
            // If there are Procurement Summary tasks, only include children of those
            if (procurementSummaryPrefixes.length > 0) {
              if (!task.wbsCode) return false;
              return procurementSummaryPrefixes.some(prefix => 
                task.wbsCode?.startsWith(prefix + ".") || task.wbsCode === prefix
              );
            }
            
            // If there are NO Procurement Summary tasks, include all procurement tasks
            // (for projects that might have different structure)
            return true;
          })
          .map(task => ({
            id: task.id,
            name: task.name,
            startDate: task.startDate || null,
            endDate: task.endDate || null,
            duration: task.duration,
            percentComplete: parseFloat(task.percentComplete?.toString() || "0"),
            projectId: latestProject.id,
            projectName: latestProject.name,
            workspaceName: workspace.name,
            client: workspace.client,
            status: workspace.status
          }));
        
        if (procurement.length > 0) {
          liveProcurementData.push(...procurement);
        } else {
          // Include project even if no procurement tasks found
          liveProcurementData.push({
            id: -1,
            name: "No procurement tasks",
            startDate: null,
            endDate: null,
            duration: null,
            percentComplete: 0,
            projectId: latestProject.id,
            projectName: latestProject.name,
            workspaceName: workspace.name,
            client: workspace.client,
            status: workspace.status
          });
        }
      }

      // Sort by workspace, then project, then task name
      liveProcurementData.sort((a, b) => {
        if (a.workspaceName !== b.workspaceName) {
          return a.workspaceName.localeCompare(b.workspaceName);
        }
        if (a.projectName !== b.projectName) {
          return a.projectName.localeCompare(b.projectName);
        }
        return a.name.localeCompare(b.name);
      });

      res.json(liveProcurementData);
    } catch (error) {
      console.error("Error fetching live procurement dates:", error);
      res.status(500).json({ error: "Failed to fetch live procurement dates" });
    }
  });

  app.get("/api/live-design-dates", async (req, res) => {
    try {
      const allWorkspaces = await storage.getAllWorkspaces();
      const liveDesignData: Array<{
        id: number;
        name: string;
        startDate: Date | null;
        endDate: Date | null;
        duration: number | null;
        percentComplete: number;
        projectId: number;
        projectName: string;
        workspaceName: string;
        client: string | undefined;
        status: string | undefined;
      }> = [];

      for (const workspace of allWorkspaces) {
        const workspaceProjects = await storage.getProjectsByWorkspace(workspace.id);
        if (workspaceProjects.length === 0) continue;

        const latestProject = workspaceProjects.reduce((latest, current) => {
          const latestDate = latest.statusDate ? new Date(latest.statusDate).getTime() : 0;
          const currentDate = current.statusDate ? new Date(current.statusDate).getTime() : 0;
          return currentDate > latestDate ? current : latest;
        });

        const tasks = await storage.getTasksByProject(latestProject.id);

        const designTasks = tasks
          .filter(task => !task.isSummary && task.name.toLowerCase().includes("design -"))
          .map(task => ({
            id: task.id,
            name: task.name,
            startDate: task.startDate || null,
            endDate: task.endDate || null,
            duration: task.duration,
            percentComplete: parseFloat(task.percentComplete?.toString() || "0"),
            projectId: latestProject.id,
            projectName: latestProject.name,
            workspaceName: workspace.name,
            client: workspace.client,
            status: workspace.status
          }));

        liveDesignData.push(...designTasks);
      }

      liveDesignData.sort((a, b) => {
        if (a.workspaceName !== b.workspaceName) return a.workspaceName.localeCompare(b.workspaceName);
        if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
        return a.name.localeCompare(b.name);
      });

      res.json(liveDesignData);
    } catch (error) {
      console.error("Error fetching live design dates:", error);
      res.status(500).json({ error: "Failed to fetch live design dates" });
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
      
      // Run automated analysis with project's status date if available
      const analysisResult = analyzeDcmaCompliance(project, tasks, project.statusDate || undefined);
      
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
          
          // Third pass: Create calendar exceptions from parsed data
          let exceptionsCreated = 0;
          if (parsedData.exceptions && parsedData.exceptions.length > 0) {
            for (const exc of parsedData.exceptions) {
              try {
                if (exc.startDate && exc.endDate) {
                  await storage.createCalendarException({
                    projectId: createdProject.id,
                    startDate: exc.startDate,
                    endDate: exc.endDate,
                    name: exc.name,
                    calendarName: exc.calendarName,
                  });
                  exceptionsCreated++;
                }
              } catch (e) {
                console.log(`[Routes] Error creating calendar exception:`, e);
              }
            }
          }
          
          res.json({ 
            success: true, 
            fileName: req.file.originalname,
            project: createdProject,
            tasksCreated: createdTasks.length,
            exceptionsCreated,
            message: `Successfully imported project "${createdProject.name}" with ${createdTasks.length} tasks and ${exceptionsCreated} calendar exceptions`
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

  // Calendar Exception routes
  app.get("/api/projects/:id/exceptions", async (req, res) => {
    try {
      const exceptions = await storage.getCalendarExceptionsByProject(parseInt(req.params.id));
      res.json(exceptions);
    } catch (error) {
      console.error("Error fetching exceptions:", error);
      res.status(500).json({ error: "Failed to fetch exceptions" });
    }
  });

  app.post("/api/projects/:id/exceptions", async (req, res) => {
    try {
      const exceptionData = insertCalendarExceptionSchema.parse({
        ...req.body,
        projectId: parseInt(req.params.id),
      });
      const exception = await storage.createCalendarException(exceptionData);
      res.json(exception);
    } catch (error) {
      console.error("Error creating exemption:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to create exemption" 
      });
    }
  });

  app.delete("/api/exceptions/:id", async (req, res) => {
    try {
      await storage.deleteCalendarException(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting exemption:", error);
      res.status(500).json({ error: "Failed to delete exemption" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
