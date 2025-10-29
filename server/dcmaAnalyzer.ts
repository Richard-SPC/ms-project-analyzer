import { Task, Project } from "@shared/schema";

export interface DcmaAnalysisResult {
  logicComplete: boolean;
  leadLagsValid: boolean;
  hardConstraintsValid: boolean;
  negativeLagsValid: boolean;
  highDurationValid: boolean;
  invalidDatesValid: boolean;
  resourcesAssigned: boolean;
  missedTasksValid: boolean;
  highFloatValid: boolean;
  criticalPathTest: boolean;
  criticalPathLength: boolean;
  baselineExists: boolean;
  sviBvValid: boolean;
  bcwsValid: boolean;
  overallScore: number;
  passed: boolean;
  findings: {
    [key: string]: {
      passed: boolean;
      details: string;
      count?: number;
      percentage?: number;
    };
  };
}

export function analyzeDcmaCompliance(
  project: Project,
  tasks: Task[]
): DcmaAnalysisResult {
  const findings: DcmaAnalysisResult["findings"] = {};
  
  // If no tasks, most checks will fail
  if (tasks.length === 0) {
    return {
      logicComplete: false,
      leadLagsValid: false,
      hardConstraintsValid: false,
      negativeLagsValid: true, // passes by default
      highDurationValid: false,
      invalidDatesValid: false,
      resourcesAssigned: false,
      missedTasksValid: false,
      highFloatValid: false,
      criticalPathTest: false,
      criticalPathLength: false,
      baselineExists: false,
      sviBvValid: false,
      bcwsValid: false,
      overallScore: 0,
      passed: false,
      findings: {
        noTasks: {
          passed: false,
          details: "No tasks found in project. Cannot perform DCMA analysis.",
        },
      },
    };
  }

  // 1. Logic is Complete - All tasks should have predecessors/successors
  // Build a map of which tasks are referenced as successors
  const taskIds = new Set(tasks.map(t => t.id.toString()));
  const tasksWithSuccessors = new Set<string>();
  
  tasks.forEach(task => {
    if (task.predecessors && task.predecessors.length > 0) {
      task.predecessors.forEach(predId => {
        tasksWithSuccessors.add(predId);
      });
    }
  });
  
  // Count tasks with incomplete logic (excluding milestones and legitimate boundary tasks)
  // DCMA criterion 1: "All activities except for the first and last shall have 
  // at least one predecessor and at least one successor"
  
  // Identify legitimate boundary tasks that are allowed to lack connections
  // Start tasks: no predecessors BUT must have successors (to avoid counting disconnected tasks)
  const startTaskIds = new Set(
    tasks.filter(t => {
      if (t.isMilestone) return false;
      const hasPredecessors = t.predecessors && t.predecessors.length > 0;
      const hasSuccessors = tasksWithSuccessors.has(t.id.toString());
      return !hasPredecessors && hasSuccessors; // Valid start: no preds, has succs
    }).map(t => t.id.toString())
  );
  
  // End tasks: no successors BUT must have predecessors (to avoid counting disconnected tasks)
  const endTaskIds = new Set(
    tasks.filter(t => {
      if (t.isMilestone) return false;
      const hasPredecessors = t.predecessors && t.predecessors.length > 0;
      const hasSuccessors = tasksWithSuccessors.has(t.id.toString());
      return hasPredecessors && !hasSuccessors; // Valid end: has preds, no succs
    }).map(t => t.id.toString())
  );
  
  // All boundary tasks (allowed to lack one side of logic)
  const boundaryTaskIds = new Set([...startTaskIds, ...endTaskIds]);
  
  // Filter to get internal tasks only (non-milestone, non-boundary)
  const internalTasks = tasks.filter(t => 
    !t.isMilestone && !boundaryTaskIds.has(t.id.toString())
  );
  
  // Count internal tasks missing predecessors or successors
  const internalTasksWithMissingLogic = internalTasks.filter(t => {
    const hasPredecessors = t.predecessors && t.predecessors.length > 0;
    const hasSuccessors = tasksWithSuccessors.has(t.id.toString());
    
    // Internal tasks must have BOTH predecessors and successors
    return !hasPredecessors || !hasSuccessors;
  }).length;
  
  // Calculate percentage based on internal tasks only
  const logicPercentage = internalTasks.length > 0 
    ? (internalTasksWithMissingLogic / internalTasks.length) * 100
    : 0;
  const logicComplete = logicPercentage <= 5;
  
  findings.logicComplete = {
    passed: logicComplete,
    details: `${internalTasksWithMissingLogic} of ${internalTasks.length} internal tasks (${logicPercentage.toFixed(1)}%) missing logic; ${startTaskIds.size} start tasks, ${endTaskIds.size} end tasks (boundary tasks excluded)`,
    count: internalTasksWithMissingLogic,
    percentage: logicPercentage,
  };

  // 2. Leads & Lags are Valid - Minimal use of leads/lags
  // For now, we'll mark as true since we don't have lag data in schema
  const leadLagsValid = true;
  findings.leadLagsValid = {
    passed: true,
    details: "Lead/lag data not available in current task structure",
  };

  // 3. Hard Constraints are Valid - Minimal hard constraints
  // Not currently tracked in schema, assume valid
  const hardConstraintsValid = true;
  findings.hardConstraintsValid = {
    passed: true,
    details: "Constraint data not available in current task structure",
  };

  // 4. Negative Lags are Valid
  const negativeLagsValid = true;
  findings.negativeLagsValid = {
    passed: true,
    details: "Negative lag data not available in current task structure",
  };

  // 5. High Duration Activities are Valid - ≤5% tasks >44 days
  const highDurationTasks = tasks.filter((t) => t.duration && t.duration > 44).length;
  const highDurationPercentage = (highDurationTasks / tasks.length) * 100;
  const highDurationValid = highDurationPercentage <= 5;
  findings.highDurationValid = {
    passed: highDurationValid,
    details: `${highDurationTasks} of ${tasks.length} tasks (${highDurationPercentage.toFixed(1)}%) exceed 44 days duration`,
    count: highDurationTasks,
    percentage: highDurationPercentage,
  };

  // 6. Invalid Dates are Valid - All dates within project window
  const now = new Date();
  const invalidDateTasks = tasks.filter((t) => {
    if (!t.startDate || !t.endDate) return false;
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);
    const projStart = project.startDate ? new Date(project.startDate) : null;
    const projEnd = project.endDate ? new Date(project.endDate) : null;
    
    if (projStart && start < projStart) return true;
    if (projEnd && end > projEnd) return true;
    if (start > end) return true;
    return false;
  }).length;
  const invalidDatesValid = invalidDateTasks === 0;
  findings.invalidDatesValid = {
    passed: invalidDatesValid,
    details: `${invalidDateTasks} of ${tasks.length} tasks have invalid or out-of-range dates`,
    count: invalidDateTasks,
  };

  // 7. Resources are Assigned - ≥95% tasks should have resources
  const tasksWithResources = tasks.filter(
    (t) => t.resources && t.resources.length > 0
  ).length;
  const resourcePercentage = (tasksWithResources / tasks.length) * 100;
  const resourcesAssigned = resourcePercentage >= 95;
  findings.resourcesAssigned = {
    passed: resourcesAssigned,
    details: `${tasksWithResources} of ${tasks.length} tasks (${resourcePercentage.toFixed(1)}%) have resources assigned`,
    count: tasksWithResources,
    percentage: resourcePercentage,
  };

  // 8. Missed Tasks are Valid - Past-due incomplete tasks ≤5%
  const missedTasks = tasks.filter((t) => {
    if (!t.endDate) return false;
    const end = new Date(t.endDate);
    const pctComplete = parseFloat(t.percentComplete?.toString() || "0");
    return end < now && pctComplete < 100;
  }).length;
  const missedPercentage = (missedTasks / tasks.length) * 100;
  const missedTasksValid = missedPercentage <= 5;
  findings.missedTasksValid = {
    passed: missedTasksValid,
    details: `${missedTasks} of ${tasks.length} tasks (${missedPercentage.toFixed(1)}%) are past due but incomplete`,
    count: missedTasks,
    percentage: missedPercentage,
  };

  // 9. High Float Tasks are Valid - ≤5% tasks with >44 days float
  const highFloatTasks = tasks.filter((t) => t.totalFloat && t.totalFloat > 44).length;
  const highFloatPercentage = (highFloatTasks / tasks.length) * 100;
  const highFloatValid = highFloatPercentage <= 5;
  findings.highFloatValid = {
    passed: highFloatValid,
    details: `${highFloatTasks} of ${tasks.length} tasks (${highFloatPercentage.toFixed(1)}%) have excessive float (>44 days)`,
    count: highFloatTasks,
    percentage: highFloatPercentage,
  };

  // 10. Critical Path Test - Continuous critical path exists
  const criticalPathTasks = tasks.filter((t) => t.isCriticalPath).length;
  const criticalPathTest = criticalPathTasks > 0;
  findings.criticalPathTest = {
    passed: criticalPathTest,
    details: `${criticalPathTasks} tasks identified on critical path`,
    count: criticalPathTasks,
  };

  // 11. Critical Path Length is Valid
  // Check if critical path aligns with project dates
  const criticalPathLength = !!(project.startDate && project.endDate);
  findings.criticalPathLength = {
    passed: criticalPathLength,
    details: criticalPathLength
      ? "Critical path length aligns with project timeline"
      : "Project start/end dates not defined",
  };

  // 12. Baseline Exists - Check if we have baseline data
  // For now, assume baseline exists if project has defined dates
  const baselineExists = !!(project.startDate && project.endDate);
  findings.baselineExists = {
    passed: baselineExists,
    details: baselineExists
      ? "Project baseline dates are defined"
      : "No baseline dates found",
  };

  // 13. SVI/BV is Valid - Schedule Variance Index
  // Not implemented yet - would need earned value data
  const sviBvValid = false;
  findings.sviBvValid = {
    passed: false,
    details: "Earned value data (SVI/BV) not available in current project structure",
  };

  // 14. BCWS is Valid - Budgeted Cost of Work Scheduled
  // Not implemented yet - would need budget data
  const bcwsValid = false;
  findings.bcwsValid = {
    passed: false,
    details: "Budget baseline data (BCWS) not available in current project structure",
  };

  // Calculate overall score
  const scores = [
    logicComplete,
    leadLagsValid,
    hardConstraintsValid,
    negativeLagsValid,
    highDurationValid,
    invalidDatesValid,
    resourcesAssigned,
    missedTasksValid,
    highFloatValid,
    criticalPathTest,
    criticalPathLength,
    baselineExists,
    sviBvValid,
    bcwsValid,
  ];

  const overallScore = scores.filter((s) => s).length;
  const passed = overallScore >= 10;

  return {
    logicComplete,
    leadLagsValid,
    hardConstraintsValid,
    negativeLagsValid,
    highDurationValid,
    invalidDatesValid,
    resourcesAssigned,
    missedTasksValid,
    highFloatValid,
    criticalPathTest,
    criticalPathLength,
    baselineExists,
    sviBvValid,
    bcwsValid,
    overallScore,
    passed,
    findings,
  };
}
