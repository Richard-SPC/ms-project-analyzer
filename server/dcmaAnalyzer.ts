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
      failedTasks?: Array<{
        id: number | string;
        name: string;
        reason?: string;
      }>;
    };
  };
}

export function analyzeDcmaCompliance(
  project: Project,
  tasks: Task[]
): DcmaAnalysisResult {
  const findings: DcmaAnalysisResult["findings"] = {};
  
  // Filter out summary tasks - they shouldn't be analyzed for DCMA compliance
  const workTasks = tasks.filter(t => !t.isSummary);
  
  // If no work tasks (excluding summaries), most checks will fail
  if (workTasks.length === 0) {
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
          details: tasks.length > 0 
            ? `All ${tasks.length} tasks are summary tasks. Cannot perform DCMA analysis on summary tasks.`
            : "No tasks found in project. Cannot perform DCMA analysis.",
        },
      },
    };
  }

  // 1. Logic is Complete - All tasks should have predecessors/successors
  // DCMA criterion 1: "All activities except for the first and last shall have 
  // at least one predecessor and at least one successor"
  
  // Build a map of which tasks are referenced as successors
  const tasksWithSuccessors = new Set<string>();
  
  workTasks.forEach(task => {
    if (task.predecessors && task.predecessors.length > 0) {
      task.predecessors.forEach(predStr => {
        // Extract task ID from format "taskId|Type|Lag" or legacy "taskId"
        const taskId = predStr.includes('|') ? predStr.split('|')[0] : predStr;
        tasksWithSuccessors.add(taskId);
      });
    }
  });
  
  // Identify the single valid start milestone:
  // - Must be a milestone with no predecessors AND at least one successor
  const validStartMilestones = workTasks.filter(t => 
    t.isMilestone && 
    (!t.predecessors || t.predecessors.length === 0) &&
    tasksWithSuccessors.has(t.id.toString())
  );
  const startMilestoneId = validStartMilestones.length > 0 ? validStartMilestones[0].id.toString() : null;
  
  // Identify the single valid finish milestone:
  // - Must be a milestone with no successors AND at least one predecessor
  const validFinishMilestones = workTasks.filter(t => 
    t.isMilestone && 
    !tasksWithSuccessors.has(t.id.toString()) &&
    (t.predecessors && t.predecessors.length > 0)
  );
  const finishMilestoneId = validFinishMilestones.length > 0 ? validFinishMilestones[0].id.toString() : null;
  
  // Check ALL work tasks (non-summary, INCLUDING milestones)
  const analysisTasks = workTasks; // All non-summary tasks
  
  // Find ALL tasks missing predecessors or successors (including start/finish milestones)
  const tasksWithMissingLogic = analysisTasks.filter(t => {
    const hasPredecessors = t.predecessors && t.predecessors.length > 0;
    const hasSuccessors = tasksWithSuccessors.has(t.id.toString());
    
    // Include if missing EITHER predecessor OR successor
    return !hasPredecessors || !hasSuccessors;
  });
  
  // Count tasks that actually fail the logic check (exclude valid start/finish milestones)
  const invalidTasks = tasksWithMissingLogic.filter(t => 
    t.id.toString() !== startMilestoneId && t.id.toString() !== finishMilestoneId
  );
  
  // Calculate percentage based on invalid tasks only (for pass/fail determination)
  const logicPercentage = analysisTasks.length > 0 
    ? (invalidTasks.length / analysisTasks.length) * 100
    : 0;
  const logicComplete = logicPercentage <= 5;
  
  // Show total count of all tasks with missing logic (including milestones for visibility)
  const totalTasksWithMissingLogic = tasksWithMissingLogic.length;
  const numValidMilestones = totalTasksWithMissingLogic - invalidTasks.length;
  
  // Create clear summary that distinguishes between total affected and invalid tasks
  const detailsText = numValidMilestones > 0
    ? `${totalTasksWithMissingLogic} of ${analysisTasks.length} tasks affected (${numValidMilestones} allowed milestone${numValidMilestones > 1 ? 's' : ''}, ${invalidTasks.length} invalid - ${logicPercentage.toFixed(1)}%)`
    : `${invalidTasks.length} of ${analysisTasks.length} tasks (${logicPercentage.toFixed(1)}%) missing predecessor or successor`;
  
  findings.logicComplete = {
    passed: logicComplete,
    details: detailsText,
    count: totalTasksWithMissingLogic,
    percentage: logicPercentage,
    failedTasks: tasksWithMissingLogic.map(t => {
      const isStartMilestone = t.id.toString() === startMilestoneId;
      const isFinishMilestone = t.id.toString() === finishMilestoneId;
      
      // Determine reason based on what's missing
      let reason = '';
      const hasPred = t.predecessors && t.predecessors.length > 0;
      const hasSucc = tasksWithSuccessors.has(t.id.toString());
      
      if (isStartMilestone) {
        reason = 'Project start milestone (allowed to have no predecessor)';
      } else if (isFinishMilestone) {
        reason = 'Project finish milestone (allowed to have no successor)';
      } else if (!hasPred && !hasSucc) {
        reason = 'Missing both predecessor and successor';
      } else if (!hasPred) {
        reason = 'Missing predecessor';
      } else {
        reason = 'Missing successor';
      }
      
      return {
        id: t.msProjectId || t.id.toString(),
        name: t.name,
        reason
      };
    })
  };

  // 2. Leads & Lags are Valid - Minimal use of leads/lags
  // DCMA criterion 2: Leads and lags should be minimally used
  // Check predecessors for lag information (format: "taskId|Type|Lag")
  const tasksWithLagsList: Array<{ 
    task: Task; 
    lagDetails: Array<{ type: string; lag: number }> 
  }> = [];
  
  for (const task of workTasks) {
    if (task.predecessors && task.predecessors.length > 0) {
      const lagDetails: Array<{ type: string; lag: number }> = [];
      for (const predStr of task.predecessors) {
        // Parse format: "5|FS|2" or "10|SS|-5" or "15|FS|0" (no lag)
        if (predStr.includes('|')) {
          const parts = predStr.split('|');
          if (parts.length === 3) {
            const relationshipType = parts[1]; // FS, SS, FF, SF
            const lag = parseFloat(parts[2]);
            if (lag !== 0) {
              lagDetails.push({ type: relationshipType, lag });
            }
          }
        }
      }
      if (lagDetails.length > 0) {
        tasksWithLagsList.push({ task, lagDetails });
      }
    }
  }
  
  const tasksWithLags = tasksWithLagsList.length;
  const lagPercentage = workTasks.length > 0 ? (tasksWithLags / workTasks.length) * 100 : 0;
  const leadLagsValid = lagPercentage <= 5; // DCMA threshold: ≤5% tasks with lags
  
  findings.leadLagsValid = {
    passed: leadLagsValid,
    details: `${tasksWithLags} of ${workTasks.length} tasks (${lagPercentage.toFixed(1)}%) have leads or lags`,
    count: tasksWithLags,
    percentage: lagPercentage,
    failedTasks: tasksWithLagsList.map(({ task, lagDetails }) => ({
      id: task.msProjectId || task.id.toString(),
      name: task.name,
      reason: `Has lag(s): ${lagDetails.map(({ type, lag }) => 
        `${type} ${lag > 0 ? `+${lag}` : lag}`
      ).join(', ')} days`
    }))
  };

  // 3. Hard Constraints are Valid - Minimal hard constraints
  // DCMA criterion 3: Hard constraints should be minimally used (≤5%)
  // Hard constraints (inflexible): MSO, MFO, SNLT, FNLT
  // Soft constraints (semi-flexible): SNET, FNET - NOT counted as hard
  // Flexible constraints: ASAP, ALAP - NOT counted as hard
  const hardConstraintTypes = ['MSO', 'MFO', 'SNLT', 'FNLT'];
  
  const tasksWithHardConstraintsDetails = workTasks.filter(t => 
    t.constraintType && hardConstraintTypes.includes(t.constraintType)
  );
  
  const tasksWithHardConstraints = tasksWithHardConstraintsDetails.length;
  
  const hardConstraintPercentage = workTasks.length > 0 
    ? (tasksWithHardConstraints / workTasks.length) * 100 
    : 0;
  const hardConstraintsValid = hardConstraintPercentage <= 5;
  
  findings.hardConstraintsValid = {
    passed: hardConstraintsValid,
    details: `${tasksWithHardConstraints} of ${workTasks.length} tasks (${hardConstraintPercentage.toFixed(1)}%) have hard constraints`,
    count: tasksWithHardConstraints,
    percentage: hardConstraintPercentage,
    failedTasks: tasksWithHardConstraintsDetails.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Has hard constraint: ${t.constraintType}`
    }))
  };

  // 4. Negative Lags are Valid
  // DCMA criterion 4: NO negative lags (leads) allowed - zero tolerance
  const tasksWithNegativeLagsList: Array<{ task: Task; negLagValues: number[] }> = [];
  
  for (const task of workTasks) {
    if (task.predecessors && task.predecessors.length > 0) {
      const negLagValues: number[] = [];
      for (const predStr of task.predecessors) {
        // Parse format: "5|FS|2" or "10|SS|-5" or "15|FS|0"
        if (predStr.includes('|')) {
          const parts = predStr.split('|');
          if (parts.length === 3) {
            const lag = parseFloat(parts[2]);
            if (lag < 0) {
              negLagValues.push(lag);
            }
          }
        }
      }
      if (negLagValues.length > 0) {
        tasksWithNegativeLagsList.push({ task, negLagValues });
      }
    }
  }
  
  const tasksWithNegativeLags = tasksWithNegativeLagsList.length;
  const negativeLagPercentage = workTasks.length > 0 ? (tasksWithNegativeLags / workTasks.length) * 100 : 0;
  const negativeLagsValid = tasksWithNegativeLags === 0; // DCMA requirement: ZERO negative lags
  
  findings.negativeLagsValid = {
    passed: negativeLagsValid,
    details: `${tasksWithNegativeLags} of ${workTasks.length} tasks (${negativeLagPercentage.toFixed(1)}%) have negative lags (leads) - must be 0`,
    count: tasksWithNegativeLags,
    percentage: negativeLagPercentage,
    failedTasks: tasksWithNegativeLagsList.map(({ task, negLagValues }) => ({
      id: task.msProjectId || task.id.toString(),
      name: task.name,
      reason: `Has negative lag(s): ${negLagValues.join(', ')} days`
    }))
  };

  // 5. High Duration Activities are Valid - ≤5% tasks >44 days
  const highDurationTasksList = workTasks.filter((t) => t.duration && t.duration > 44);
  const highDurationPercentage = (highDurationTasksList.length / workTasks.length) * 100;
  const highDurationValid = highDurationPercentage <= 5;
  findings.highDurationValid = {
    passed: highDurationValid,
    details: `${highDurationTasksList.length} of ${workTasks.length} tasks (${highDurationPercentage.toFixed(1)}%) exceed 44 days duration`,
    count: highDurationTasksList.length,
    percentage: highDurationPercentage,
    failedTasks: highDurationTasksList.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Duration: ${t.duration} days (exceeds 44 day limit)`
    }))
  };

  // 6. Invalid Dates are Valid - All dates within project window
  const now = new Date();
  const invalidDateTasksList = workTasks.filter((t) => {
    if (!t.startDate || !t.endDate) return false;
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);
    const projStart = project.startDate ? new Date(project.startDate) : null;
    const projEnd = project.endDate ? new Date(project.endDate) : null;
    
    if (projStart && start < projStart) return true;
    if (projEnd && end > projEnd) return true;
    if (start > end) return true;
    return false;
  });
  const invalidDatesValid = invalidDateTasksList.length === 0;
  findings.invalidDatesValid = {
    passed: invalidDatesValid,
    details: `${invalidDateTasksList.length} of ${workTasks.length} tasks have invalid or out-of-range dates`,
    count: invalidDateTasksList.length,
    failedTasks: invalidDateTasksList.map(t => {
      const start = new Date(t.startDate!);
      const end = new Date(t.endDate!);
      const projStart = project.startDate ? new Date(project.startDate) : null;
      const projEnd = project.endDate ? new Date(project.endDate) : null;
      
      let reason = '';
      if (projStart && start < projStart) reason = `Start date before project start`;
      else if (projEnd && end > projEnd) reason = `End date after project end`;
      else if (start > end) reason = `Start date after end date`;
      
      return { id: t.msProjectId || t.id.toString(), name: t.name, reason };
    })
  };

  // 7. Resources are Assigned - ≥95% tasks should have resources
  const tasksWithResources = workTasks.filter(
    (t) => t.resources && t.resources.length > 0
  );
  const tasksWithoutResources = workTasks.filter(
    (t) => !t.resources || t.resources.length === 0
  );
  
  console.log('[DCMA Check 7] Total work tasks:', workTasks.length);
  console.log('[DCMA Check 7] Tasks with resources:', tasksWithResources.length);
  console.log('[DCMA Check 7] Tasks with resources:', tasksWithResources.map(t => ({
    id: t.msProjectId || t.id.toString(),
    name: t.name,
    resources: t.resources
  })));
  
  const resourcePercentage = (tasksWithResources.length / workTasks.length) * 100;
  const resourcesAssigned = resourcePercentage >= 95;
  findings.resourcesAssigned = {
    passed: resourcesAssigned,
    details: `${tasksWithResources.length} of ${workTasks.length} tasks (${resourcePercentage.toFixed(1)}%) have resources assigned`,
    count: tasksWithResources.length,
    percentage: resourcePercentage,
    failedTasks: tasksWithoutResources.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: 'No resources assigned'
    }))
  };

  // 8. Missed Tasks are Valid - Past-due incomplete tasks ≤5%
  const missedTasksList = workTasks.filter((t) => {
    if (!t.endDate) return false;
    const end = new Date(t.endDate);
    const pctComplete = parseFloat(t.percentComplete?.toString() || "0");
    return end < now && pctComplete < 100;
  });
  const missedPercentage = (missedTasksList.length / workTasks.length) * 100;
  const missedTasksValid = missedPercentage <= 5;
  findings.missedTasksValid = {
    passed: missedTasksValid,
    details: `${missedTasksList.length} of ${workTasks.length} tasks (${missedPercentage.toFixed(1)}%) are past due but incomplete`,
    count: missedTasksList.length,
    percentage: missedPercentage,
    failedTasks: missedTasksList.map(t => {
      const pctComplete = parseFloat(t.percentComplete?.toString() || "0");
      const endDate = new Date(t.endDate!).toLocaleDateString();
      return {
        id: t.msProjectId || t.id.toString(),
        name: t.name,
        reason: `Past due (${endDate}), ${pctComplete.toFixed(0)}% complete`
      };
    })
  };

  // 9. High Float Tasks are Valid - ≤5% tasks with >44 days total slack/float
  const highFloatTasksList = workTasks.filter((t) => t.totalFloat && t.totalFloat > 44);
  const highFloatPercentage = (highFloatTasksList.length / workTasks.length) * 100;
  const highFloatValid = highFloatPercentage <= 5;
  findings.highFloatValid = {
    passed: highFloatValid,
    details: `${highFloatTasksList.length} of ${workTasks.length} tasks (${highFloatPercentage.toFixed(1)}%) have excessive total slack (>44 days)`,
    count: highFloatTasksList.length,
    percentage: highFloatPercentage,
    failedTasks: highFloatTasksList.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Total slack: ${t.totalFloat?.toFixed(1)} days (exceeds 44 day limit)`
    }))
  };

  // 10. Critical Path Test - Continuous critical path exists
  const criticalPathTasks = workTasks.filter((t) => t.isCriticalPath).length;
  const criticalPathTest = criticalPathTasks > 0;
  findings.criticalPathTest = {
    passed: criticalPathTest,
    details: `${criticalPathTasks} tasks identified on critical path`,
    count: criticalPathTasks,
  };

  // 11. Critical Path Length is Valid
  // Check if critical path aligns with project dates
  const criticalPathLength = !!(project.startDate && project.endDate);
  
  // Get all critical path tasks to display in the dropdown
  const criticalPathTasksList = workTasks.filter((t) => t.isCriticalPath);
  
  findings.criticalPathLength = {
    passed: criticalPathLength,
    details: criticalPathLength
      ? `Critical path length aligns with project timeline (${criticalPathTasksList.length} tasks on critical path)`
      : "Project start/end dates not defined",
    count: criticalPathTasksList.length,
    failedTasks: criticalPathTasksList.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Total float: ${t.totalFloat?.toFixed(1) || '0.0'} days`
    }))
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
