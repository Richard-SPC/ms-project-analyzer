import {
  type Workspace,
  type InsertWorkspace,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type DcmaAssessment,
  type InsertDcmaAssessment,
  type CalendarException,
  type InsertCalendarException,
  type User,
  type InsertUser,
  workspaces,
  projects,
  tasks,
  dcmaAssessments,
  calendarExceptions,
  users,
} from "@shared/schema";
import { db, type DbClient } from "../db";
import { eq, desc, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  // Workspace operations
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getAllWorkspaces(): Promise<Workspace[]>;
  updateWorkspace(id: number, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  deleteWorkspace(id: number): Promise<void>;
  getProjectsByWorkspace(workspaceId: number): Promise<Project[]>;
  getUnassignedProjects(): Promise<Project[]>;

  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  // Task operations
  createTask(task: InsertTask): Promise<Task>;
  getTask(id: number): Promise<Task | undefined>;
  getTasksByProject(projectId: number): Promise<Task[]>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;

  // DCMA Assessment operations
  createDcmaAssessment(assessment: InsertDcmaAssessment): Promise<DcmaAssessment>;
  getDcmaAssessmentsByProject(projectId: number): Promise<DcmaAssessment[]>;
  getLatestDcmaAssessment(projectId: number): Promise<DcmaAssessment | undefined>;
  updateDcmaAssessment(id: number, assessment: Partial<InsertDcmaAssessment>): Promise<DcmaAssessment | undefined>;

  // Calendar Exception operations
  createCalendarException(exception: InsertCalendarException): Promise<CalendarException>;
  getCalendarExceptionsByProject(projectId: number): Promise<CalendarException[]>;
  deleteCalendarException(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private workspaces: Map<number, Workspace>;
  private projects: Map<number, Project>;
  private tasks: Map<number, Task>;
  private dcmaAssessments: Map<number, DcmaAssessment>;
  private calendarExceptions: Map<number, CalendarException>;
  private users: Map<number, User>;
  private workspaceIdCounter: number;
  private projectIdCounter: number;
  private taskIdCounter: number;
  private dcmaIdCounter: number;
  private exceptionIdCounter: number;
  private userIdCounter: number;

  constructor() {
    this.workspaces = new Map();
    this.projects = new Map();
    this.tasks = new Map();
    this.dcmaAssessments = new Map();
    this.calendarExceptions = new Map();
    this.users = new Map();
    this.workspaceIdCounter = 1;
    this.projectIdCounter = 1;
    this.taskIdCounter = 1;
    this.dcmaIdCounter = 1;
    this.exceptionIdCounter = 1;
    this.userIdCounter = 1;
  }

  async seedDefaultUser() {
    // Pre-hash the password for the default admin
    const salt = "default_salt_1234567890123456";
    const { scryptSync } = await import("crypto");
    const hashed = scryptSync("admin123", salt, 64).toString("hex");
    const user: User = {
      id: this.userIdCounter++,
      username: "admin",
      password: `${hashed}.${salt}`,
      name: "Admin User",
      role: "admin",
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
  }

  // User operations
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      ...insertUser,
      id,
      name: insertUser.name ?? null,
      role: insertUser.role ?? "user",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated: User = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
  }

  // Workspace operations
  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const id = this.workspaceIdCounter++;
    const workspace: Workspace = {
      ...insertWorkspace,
      id,
      description: insertWorkspace.description ?? null,
      color: insertWorkspace.color ?? "#3B82F6",
      createdAt: new Date(),
    };
    this.workspaces.set(id, workspace);
    return workspace;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return Array.from(this.workspaces.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateWorkspace(id: number, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;
    
    const updated: Workspace = { ...workspace, ...updates };
    this.workspaces.set(id, updated);
    return updated;
  }

  async deleteWorkspace(id: number): Promise<void> {
    this.workspaces.delete(id);
    // Set workspaceId to null for all projects in this workspace
    Array.from(this.projects.entries()).forEach(([projectId, project]) => {
      if (project.workspaceId === id) {
        this.projects.set(projectId, { ...project, workspaceId: null });
      }
    });
  }

  async getProjectsByWorkspace(workspaceId: number): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(project => project.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnassignedProjects(): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(project => project.workspaceId === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Project operations
  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectIdCounter++;
    const project: Project = {
      ...insertProject,
      id,
      workspaceId: insertProject.workspaceId ?? null,
      status: insertProject.status ?? "active",
      description: insertProject.description ?? null,
      startDate: insertProject.startDate ?? null,
      endDate: insertProject.endDate ?? null,
      necCompliant: insertProject.necCompliant ?? null,
      projectManager: insertProject.projectManager ?? null,
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updated: Project = { 
      ...project, 
      ...updates,
      status: updates.status ?? project.status,
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    this.projects.delete(id);
    
    // Delete related tasks
    Array.from(this.tasks.entries()).forEach(([taskId, task]) => {
      if (task.projectId === id) {
        this.tasks.delete(taskId);
      }
    });
    
    // Delete related assessments
    Array.from(this.dcmaAssessments.entries()).forEach(([assessmentId, assessment]) => {
      if (assessment.projectId === id) {
        this.dcmaAssessments.delete(assessmentId);
      }
    });
  }

  // Task operations
  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const task: Task = {
      ...insertTask,
      id,
      msProjectId: insertTask.msProjectId ?? null,
      wbsCode: insertTask.wbsCode ?? null,
      duration: insertTask.duration ?? null,
      startDate: insertTask.startDate ?? null,
      endDate: insertTask.endDate ?? null,
      percentComplete: insertTask.percentComplete ?? "0",
      predecessors: insertTask.predecessors ?? null,
      resources: insertTask.resources ?? null,
      isCriticalPath: insertTask.isCriticalPath ?? null,
      totalFloat: insertTask.totalFloat ?? null,
      isMilestone: insertTask.isMilestone ?? null,
      isSummary: insertTask.isSummary ?? null,
      constraintType: insertTask.constraintType ?? null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.projectId === projectId);
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updated: Task = { 
      ...task, 
      ...updates,
      isCriticalPath: updates.isCriticalPath ?? task.isCriticalPath,
      isMilestone: updates.isMilestone ?? task.isMilestone,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    this.tasks.delete(id);
  }

  // DCMA Assessment operations
  async createDcmaAssessment(insertAssessment: InsertDcmaAssessment): Promise<DcmaAssessment> {
    const id = this.dcmaIdCounter++;
    const assessment: DcmaAssessment = {
      ...insertAssessment,
      id,
      logicComplete: insertAssessment.logicComplete ?? null,
      leadLagsValid: insertAssessment.leadLagsValid ?? null,
      hardConstraintsValid: insertAssessment.hardConstraintsValid ?? null,
      negativeLagsValid: insertAssessment.negativeLagsValid ?? null,
      highDurationValid: insertAssessment.highDurationValid ?? null,
      invalidDatesValid: insertAssessment.invalidDatesValid ?? null,
      resourcesAssigned: insertAssessment.resourcesAssigned ?? null,
      missedTasksValid: insertAssessment.missedTasksValid ?? null,
      highFloatValid: insertAssessment.highFloatValid ?? null,
      criticalPathTest: insertAssessment.criticalPathTest ?? null,
      criticalPathLength: insertAssessment.criticalPathLength ?? null,
      baselineExists: insertAssessment.baselineExists ?? null,
      sviBvValid: insertAssessment.sviBvValid ?? null,
      bcwsValid: insertAssessment.bcwsValid ?? null,
      // Manual overrides default to false
      logicCompleteOverride: insertAssessment.logicCompleteOverride ?? false,
      leadLagsValidOverride: insertAssessment.leadLagsValidOverride ?? false,
      hardConstraintsValidOverride: insertAssessment.hardConstraintsValidOverride ?? false,
      negativeLagsValidOverride: insertAssessment.negativeLagsValidOverride ?? false,
      highDurationValidOverride: insertAssessment.highDurationValidOverride ?? false,
      invalidDatesValidOverride: insertAssessment.invalidDatesValidOverride ?? false,
      resourcesAssignedOverride: insertAssessment.resourcesAssignedOverride ?? false,
      missedTasksValidOverride: insertAssessment.missedTasksValidOverride ?? false,
      highFloatValidOverride: insertAssessment.highFloatValidOverride ?? false,
      criticalPathTestOverride: insertAssessment.criticalPathTestOverride ?? false,
      criticalPathLengthOverride: insertAssessment.criticalPathLengthOverride ?? false,
      baselineExistsOverride: insertAssessment.baselineExistsOverride ?? false,
      sviBvValidOverride: insertAssessment.sviBvValidOverride ?? false,
      bcwsValidOverride: insertAssessment.bcwsValidOverride ?? false,
      overallScore: insertAssessment.overallScore ?? null,
      passed: insertAssessment.passed ?? null,
      notes: insertAssessment.notes ?? null,
      assessmentDate: insertAssessment.assessmentDate ?? new Date(),
    };
    this.dcmaAssessments.set(id, assessment);
    return assessment;
  }

  async getDcmaAssessmentsByProject(projectId: number): Promise<DcmaAssessment[]> {
    return Array.from(this.dcmaAssessments.values())
      .filter(assessment => assessment.projectId === projectId)
      .sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
  }

  async getLatestDcmaAssessment(projectId: number): Promise<DcmaAssessment | undefined> {
    const assessments = await this.getDcmaAssessmentsByProject(projectId);
    return assessments[0];
  }

  async updateDcmaAssessment(id: number, updates: Partial<InsertDcmaAssessment>): Promise<DcmaAssessment | undefined> {
    const assessment = this.dcmaAssessments.get(id);
    if (!assessment) return undefined;
    
    const updated: DcmaAssessment = { 
      ...assessment, 
      ...updates,
    };
    this.dcmaAssessments.set(id, updated);
    return updated;
  }

  async createCalendarException(insertException: InsertCalendarException): Promise<CalendarException> {
    const id = this.exceptionIdCounter++;
    const exception: CalendarException = {
      ...insertException,
      id,
      description: insertException.description ?? null,
      createdAt: new Date(),
    };
    this.calendarExceptions.set(id, exception);
    return exception;
  }

  async getCalendarExceptionsByProject(projectId: number): Promise<CalendarException[]> {
    return Array.from(this.calendarExceptions.values())
      .filter(exc => exc.projectId === projectId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async deleteCalendarException(id: number): Promise<void> {
    this.calendarExceptions.delete(id);
  }

}

// Database storage implementation using Drizzle ORM and PostgreSQL
export class DbStorage implements IStorage {
  constructor(private db: DbClient) {}

  // Workspace operations
  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const [workspace] = await this.db.insert(workspaces).values(insertWorkspace).returning();
    return workspace;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [workspace] = await this.db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return await this.db.select().from(workspaces).orderBy(desc(workspaces.createdAt));
  }

  async updateWorkspace(id: number, updates: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const [updated] = await this.db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, id))
      .returning();
    return updated;
  }

  async deleteWorkspace(id: number): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async getProjectsByWorkspace(workspaceId: number): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.createdAt));
  }

  async getUnassignedProjects(): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .where(isNull(projects.workspaceId))
      .orderBy(desc(projects.createdAt));
  }

  // Project operations
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await this.db.insert(projects).values(insertProject).returning();
    return project;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await this.db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id));
    // Cascade delete is handled by database foreign key constraints
  }

  // Task operations
  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await this.db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    return await this.db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await this.db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }

  // DCMA Assessment operations
  async createDcmaAssessment(insertAssessment: InsertDcmaAssessment): Promise<DcmaAssessment> {
    const [assessment] = await this.db.insert(dcmaAssessments).values(insertAssessment).returning();
    return assessment;
  }

  async getDcmaAssessmentsByProject(projectId: number): Promise<DcmaAssessment[]> {
    return await this.db
      .select()
      .from(dcmaAssessments)
      .where(eq(dcmaAssessments.projectId, projectId))
      .orderBy(desc(dcmaAssessments.assessmentDate));
  }

  async getLatestDcmaAssessment(projectId: number): Promise<DcmaAssessment | undefined> {
    const [assessment] = await this.db
      .select()
      .from(dcmaAssessments)
      .where(eq(dcmaAssessments.projectId, projectId))
      .orderBy(desc(dcmaAssessments.assessmentDate))
      .limit(1);
    return assessment;
  }

  async updateDcmaAssessment(id: number, updates: Partial<InsertDcmaAssessment>): Promise<DcmaAssessment | undefined> {
    const [updated] = await this.db
      .update(dcmaAssessments)
      .set(updates)
      .where(eq(dcmaAssessments.id, id))
      .returning();
    return updated;
  }

  async createCalendarException(insertException: InsertCalendarException): Promise<CalendarException> {
    const [exception] = await this.db.insert(calendarExceptions).values(insertException).returning();
    return exception;
  }

  async getCalendarExceptionsByProject(projectId: number): Promise<CalendarException[]> {
    return await this.db
      .select()
      .from(calendarExceptions)
      .where(eq(calendarExceptions.projectId, projectId))
      .orderBy(calendarExceptions.startDate);
  }

  async deleteCalendarException(id: number): Promise<void> {
    await this.db.delete(calendarExceptions).where(eq(calendarExceptions.id, id));
  }

  // User operations
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

}

// Use database storage if DATABASE_URL is available, otherwise fall back to in-memory storage
export const storage = db ? new DbStorage(db) : new MemStorage();
