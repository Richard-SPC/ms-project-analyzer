import {
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type DcmaAssessment,
  type InsertDcmaAssessment,
  type NecCompliance,
  type InsertNecCompliance,
} from "@shared/schema";

export interface IStorage {
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
  
  // NEC Compliance operations
  createNecCompliance(compliance: InsertNecCompliance): Promise<NecCompliance>;
  getNecComplianceByProject(projectId: number): Promise<NecCompliance[]>;
  getLatestNecCompliance(projectId: number): Promise<NecCompliance | undefined>;
}

export class MemStorage implements IStorage {
  private projects: Map<number, Project>;
  private tasks: Map<number, Task>;
  private dcmaAssessments: Map<number, DcmaAssessment>;
  private necCompliances: Map<number, NecCompliance>;
  private projectIdCounter: number;
  private taskIdCounter: number;
  private dcmaIdCounter: number;
  private necIdCounter: number;

  constructor() {
    this.projects = new Map();
    this.tasks = new Map();
    this.dcmaAssessments = new Map();
    this.necCompliances = new Map();
    this.projectIdCounter = 1;
    this.taskIdCounter = 1;
    this.dcmaIdCounter = 1;
    this.necIdCounter = 1;
  }

  // Project operations
  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectIdCounter++;
    const project: Project = {
      ...insertProject,
      id,
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
    
    // Delete related NEC compliance
    Array.from(this.necCompliances.entries()).forEach(([complianceId, compliance]) => {
      if (compliance.projectId === id) {
        this.necCompliances.delete(complianceId);
      }
    });
  }

  // Task operations
  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const task: Task = {
      ...insertTask,
      id,
      msProjectUid: insertTask.msProjectUid ?? null,
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

  // NEC Compliance operations
  async createNecCompliance(insertCompliance: InsertNecCompliance): Promise<NecCompliance> {
    const id = this.necIdCounter++;
    const compliance: NecCompliance = {
      ...insertCompliance,
      id,
      programmeDefined: insertCompliance.programmeDefined ?? null,
      acceptedProgramme: insertCompliance.acceptedProgramme ?? null,
      regularUpdates: insertCompliance.regularUpdates ?? null,
      earlyWarningsManaged: insertCompliance.earlyWarningsManaged ?? null,
      compensationEventsTracked: insertCompliance.compensationEventsTracked ?? null,
      keyDatesIdentified: insertCompliance.keyDatesIdentified ?? null,
      completionDateRealistic: insertCompliance.completionDateRealistic ?? null,
      resourcesAdequate: insertCompliance.resourcesAdequate ?? null,
      overallCompliant: insertCompliance.overallCompliant ?? null,
      notes: insertCompliance.notes ?? null,
      assessmentDate: insertCompliance.assessmentDate ?? new Date(),
    };
    this.necCompliances.set(id, compliance);
    return compliance;
  }

  async getNecComplianceByProject(projectId: number): Promise<NecCompliance[]> {
    return Array.from(this.necCompliances.values())
      .filter(compliance => compliance.projectId === projectId)
      .sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
  }

  async getLatestNecCompliance(projectId: number): Promise<NecCompliance | undefined> {
    const compliances = await this.getNecComplianceByProject(projectId);
    return compliances[0];
  }
}

export const storage = new MemStorage();
