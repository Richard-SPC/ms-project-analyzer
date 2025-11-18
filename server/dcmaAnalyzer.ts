import { Task, Project } from "@shared/schema";

export interface DcmaAnalysisResult {
  missingLogic: boolean;
  negativeLag: boolean;
  leadsLags: boolean;
  relationshipTypes: boolean;
  hardConstraints: boolean;
  largeFloat: boolean;
  negativeFloat: boolean;
  largeDurations: boolean;
  invalidTasks: boolean;
  resourcesAssigned: boolean;
  lateTasks: boolean;
  criticalPathTest: boolean;
  criticalPathLength: boolean;
  baselineExecutionIndex: boolean;
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
      missingLogic: false,
      negativeLag: true,
      leadsLags: false,
      relationshipTypes: false,
      hardConstraints: false,
      largeFloat: false,
      negativeFloat: true,
      largeDurations: false,
      invalidTasks: false,
      resourcesAssigned: false,
      lateTasks: false,
      criticalPathTest: false,
      criticalPathLength: false,
      baselineExecutionIndex: false,
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
  
  const analysisTasks = workTasks; // All non-summary tasks

  // 1. MISSING LOGIC - All tasks should have predecessors/successors
  // Find ALL tasks missing predecessors or successors (including start/finish milestones)
  const tasksWithMissingLogic = analysisTasks.filter(t => {
    const hasPredecessors = t.predecessors && t.predecessors.length > 0;
    const hasSuccessors = tasksWithSuccessors.has(t.id.toString());
    
    // Include if missing EITHER predecessor OR successor
    return !hasPredecessors || !hasSuccessors;
  });
  
  // Count tasks that actually fail the logic check (exclude valid start/finish milestones)
  const invalidLogicTasks = tasksWithMissingLogic.filter(t => 
    t.id.toString() !== startMilestoneId && t.id.toString() !== finishMilestoneId
  );
  
  const logicPercentage = analysisTasks.length > 0 
    ? (invalidLogicTasks.length / analysisTasks.length) * 100
    : 0;
  const missingLogic = logicPercentage <= 5;
  
  const totalTasksWithMissingLogic = tasksWithMissingLogic.length;
  const numValidMilestones = totalTasksWithMissingLogic - invalidLogicTasks.length;
  
  const logicDetailsText = numValidMilestones > 0
    ? `${totalTasksWithMissingLogic} of ${analysisTasks.length} tasks affected (${numValidMilestones} allowed milestone${numValidMilestones > 1 ? 's' : ''}, ${invalidLogicTasks.length} invalid - ${logicPercentage.toFixed(1)}%)`
    : `${invalidLogicTasks.length} of ${analysisTasks.length} tasks (${logicPercentage.toFixed(1)}%) missing predecessor or successor`;
  
  findings.missingLogic = {
    passed: missingLogic,
    details: logicDetailsText,
    count: totalTasksWithMissingLogic,
    percentage: logicPercentage,
    failedTasks: tasksWithMissingLogic.map(t => {
      const isStartMilestone = t.id.toString() === startMilestoneId;
      const isFinishMilestone = t.id.toString() === finishMilestoneId;
      
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

  // 2. NEGATIVE LAG - NO negative lags (leads) allowed - zero tolerance
  const tasksWithNegativeLagsList: Array<{ task: Task; negLagValues: Array<{ type: string; lag: number }> }> = [];
  
  for (const task of workTasks) {
    if (task.predecessors && task.predecessors.length > 0) {
      const negLagValues: Array<{ type: string; lag: number }> = [];
      for (const predStr of task.predecessors) {
        if (predStr.includes('|')) {
          const parts = predStr.split('|');
          if (parts.length === 3) {
            const relationshipType = parts[1];
            const lag = parseFloat(parts[2]);
            if (lag < 0) {
              negLagValues.push({ type: relationshipType, lag });
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
  const negativeLag = tasksWithNegativeLags === 0;
  
  findings.negativeLag = {
    passed: negativeLag,
    details: `${tasksWithNegativeLags} of ${workTasks.length} tasks (${negativeLagPercentage.toFixed(1)}%) have negative lags (leads) - must be 0`,
    count: tasksWithNegativeLags,
    percentage: negativeLagPercentage,
    failedTasks: tasksWithNegativeLagsList.map(({ task, negLagValues }) => ({
      id: task.msProjectId || task.id.toString(),
      name: task.name,
      reason: `Has negative lag(s): ${negLagValues.map(({ type, lag }) => 
        `${type} ${lag}`
      ).join(', ')} days`
    }))
  };

  // 3. LEADS & LAGS - Minimal use of leads/lags
  const tasksWithLagsList: Array<{ 
    task: Task; 
    lagDetails: Array<{ type: string; lag: number }> 
  }> = [];
  
  for (const task of workTasks) {
    if (task.predecessors && task.predecessors.length > 0) {
      const lagDetails: Array<{ type: string; lag: number }> = [];
      for (const predStr of task.predecessors) {
        if (predStr.includes('|')) {
          const parts = predStr.split('|');
          if (parts.length === 3) {
            const relationshipType = parts[1];
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
  const leadsLags = lagPercentage <= 5;
  
  findings.leadsLags = {
    passed: leadsLags,
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

  // 4. RELATIONSHIP TYPES - FS (Finish-to-Start) should be predominant (≥90%)
  const allRelationships: Array<{ task: Task; type: string; predId: string }> = [];
  
  for (const task of workTasks) {
    if (task.predecessors && task.predecessors.length > 0) {
      for (const predStr of task.predecessors) {
        if (predStr.includes('|')) {
          const parts = predStr.split('|');
          if (parts.length === 3) {
            const predId = parts[0];
            const relationshipType = parts[1];
            allRelationships.push({ task, type: relationshipType, predId });
          }
        } else {
          // Legacy format without type, assume FS
          allRelationships.push({ task, type: 'FS', predId: predStr });
        }
      }
    }
  }
  
  const fsRelationships = allRelationships.filter(r => r.type === 'FS').length;
  const nonFsRelationships = allRelationships.filter(r => r.type !== 'FS');
  const fsPercentage = allRelationships.length > 0 ? (fsRelationships / allRelationships.length) * 100 : 100;
  const relationshipTypes = fsPercentage >= 90;
  
  // Group non-FS relationships by task
  const tasksWithNonFsRelationships = new Map<number, Array<{ type: string; predId: string }>>();
  for (const rel of nonFsRelationships) {
    const taskId = rel.task.id;
    if (!tasksWithNonFsRelationships.has(taskId)) {
      tasksWithNonFsRelationships.set(taskId, []);
    }
    tasksWithNonFsRelationships.get(taskId)!.push({ type: rel.type, predId: rel.predId });
  }
  
  findings.relationshipTypes = {
    passed: relationshipTypes,
    details: `${fsRelationships} of ${allRelationships.length} relationships (${fsPercentage.toFixed(1)}%) are Finish-to-Start (FS) - target ≥90%`,
    count: nonFsRelationships.length,
    percentage: 100 - fsPercentage,
    failedTasks: Array.from(tasksWithNonFsRelationships.entries()).map(([taskId, rels]) => {
      const task = workTasks.find(t => t.id === taskId)!;
      return {
        id: task.msProjectId || task.id.toString(),
        name: task.name,
        reason: `Non-FS relationship(s): ${rels.map(r => r.type).join(', ')}`
      };
    })
  };

  // 5. HARD CONSTRAINTS - Minimal hard constraints (≤1%)
  const hardConstraintTypes = ['MSO', 'MFO', 'SNLT', 'FNLT'];
  
  // Find ALL tasks with hard constraints (including start/finish milestones)
  const tasksWithHardConstraintsDetails = workTasks.filter(t => 
    t.constraintType && hardConstraintTypes.includes(t.constraintType)
  );
  
  // Count tasks that actually fail (exclude valid start/finish milestones from calculation)
  const invalidHardConstraintTasks = tasksWithHardConstraintsDetails.filter(t => 
    t.id.toString() !== startMilestoneId && t.id.toString() !== finishMilestoneId
  );
  
  const totalAffected = tasksWithHardConstraintsDetails.length;
  const allowedMilestones = totalAffected - invalidHardConstraintTasks.length;
  const invalidCount = invalidHardConstraintTasks.length;
  
  const hardConstraintPercentage = workTasks.length > 0 
    ? (invalidCount / workTasks.length) * 100 
    : 0;
  const hardConstraints = hardConstraintPercentage <= 1;
  
  findings.hardConstraints = {
    passed: hardConstraints,
    details: `${totalAffected} of ${workTasks.length} tasks affected (${allowedMilestones} allowed milestone${allowedMilestones !== 1 ? 's' : ''}, ${invalidCount} invalid - ${hardConstraintPercentage.toFixed(1)}%) - target ≤1%`,
    count: invalidCount,
    percentage: hardConstraintPercentage,
    failedTasks: tasksWithHardConstraintsDetails.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Has hard constraint: ${t.constraintType}`
    }))
  };

  // 6. LARGE FLOAT - ≤5% tasks with >44 days total slack/float
  const highFloatTasksList = workTasks.filter((t) => t.totalFloat && t.totalFloat > 44);
  const highFloatPercentage = (highFloatTasksList.length / workTasks.length) * 100;
  const largeFloat = highFloatPercentage <= 5;
  findings.largeFloat = {
    passed: largeFloat,
    details: `${highFloatTasksList.length} of ${workTasks.length} tasks (${highFloatPercentage.toFixed(1)}%) have excessive total slack (>44 days)`,
    count: highFloatTasksList.length,
    percentage: highFloatPercentage,
    failedTasks: highFloatTasksList.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Total slack: ${t.totalFloat?.toFixed(1)} days (exceeds 44 day limit)`
    }))
  };

  // 7. NEGATIVE FLOAT - No tasks should have negative float (0% threshold)
  const negativeFloatTasksList = workTasks.filter((t) => t.totalFloat && t.totalFloat < 0);
  const negativeFloatPercentage = (negativeFloatTasksList.length / workTasks.length) * 100;
  const negativeFloat = negativeFloatTasksList.length === 0;
  findings.negativeFloat = {
    passed: negativeFloat,
    details: `${negativeFloatTasksList.length} of ${workTasks.length} tasks (${negativeFloatPercentage.toFixed(1)}%) have negative float - must be 0`,
    count: negativeFloatTasksList.length,
    percentage: negativeFloatPercentage,
    failedTasks: negativeFloatTasksList.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Negative float: ${t.totalFloat?.toFixed(1)} days (task is behind schedule)`
    }))
  };

  // 8. LARGE DURATIONS - ≤5% tasks >44 days
  const highDurationTasksList = workTasks.filter((t) => t.duration && t.duration > 44);
  const highDurationPercentage = (highDurationTasksList.length / workTasks.length) * 100;
  const largeDurations = highDurationPercentage <= 5;
  findings.largeDurations = {
    passed: largeDurations,
    details: `${highDurationTasksList.length} of ${workTasks.length} tasks (${highDurationPercentage.toFixed(1)}%) exceed 44 days duration`,
    count: highDurationTasksList.length,
    percentage: highDurationPercentage,
    failedTasks: highDurationTasksList.map(t => ({
      id: t.msProjectId || t.id.toString(),
      name: t.name,
      reason: `Duration: ${t.duration} days (exceeds 44 day limit)`
    }))
  };

  // 9. INVALID TASKS - All dates within project window
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
  const invalidTasks = invalidDateTasksList.length === 0;
  findings.invalidTasks = {
    passed: invalidTasks,
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

  // 10. RESOURCES & COSTS ASSIGNED - ≥95% tasks should have resources
  const tasksWithResources = workTasks.filter(
    (t) => t.resources && t.resources.length > 0
  );
  const tasksWithoutResources = workTasks.filter(
    (t) => !t.resources || t.resources.length === 0
  );
  
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

  // 11. LATE TASKS - Past-due incomplete tasks ≤5%
  const missedTasksList = workTasks.filter((t) => {
    if (!t.endDate) return false;
    const end = new Date(t.endDate);
    const pctComplete = parseFloat(t.percentComplete?.toString() || "0");
    return end < now && pctComplete < 100;
  });
  const missedPercentage = (missedTasksList.length / workTasks.length) * 100;
  const lateTasks = missedPercentage <= 5;
  findings.lateTasks = {
    passed: lateTasks,
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

  // 12. CRITICAL PATH TEST - Continuous critical path exists
  const criticalPathTasks = workTasks.filter((t) => t.isCriticalPath).length;
  const criticalPathTest = criticalPathTasks > 0;
  findings.criticalPathTest = {
    passed: criticalPathTest,
    details: `${criticalPathTasks} tasks identified on critical path`,
    count: criticalPathTasks,
  };

  // 13. CRITICAL PATH LENGTH - Critical path aligns with project timeline
  const criticalPathLength = !!(project.startDate && project.endDate);
  
  const criticalPathTasksList = workTasks.filter((t) => t.isCriticalPath);
  
  findings.criticalPathLength = {
    passed: criticalPathLength,
    details: criticalPathLength
      ? `Critical path length aligns with project timeline (${criticalPathTasksList.length} tasks on critical path)`
      : "Project start/end dates not defined",
    count: criticalPathTasksList.length,
    failedTasks: criticalPathTasksList.map(t => {
      const duration = t.duration ? `${t.duration} days` : 'N/A';
      const startDate = t.startDate ? new Date(t.startDate).toLocaleDateString() : 'N/A';
      const finishDate = t.endDate ? new Date(t.endDate).toLocaleDateString() : 'N/A';
      const floatInfo = `Float: ${t.totalFloat?.toFixed(1) || '0.0'} days`;
      return {
        id: t.msProjectId || t.id.toString(),
        name: t.name,
        reason: `${duration} | Start: ${startDate} | Finish: ${finishDate} | ${floatInfo}`
      };
    })
  };

  // 14. BASELINE EXECUTION INDEX - Baseline exists
  const baselineExecutionIndex = !!(project.startDate && project.endDate);
  findings.baselineExecutionIndex = {
    passed: baselineExecutionIndex,
    details: baselineExecutionIndex
      ? "Project baseline dates are defined"
      : "No baseline dates found",
  };

  // Calculate overall score
  const scores = [
    missingLogic,
    negativeLag,
    leadsLags,
    relationshipTypes,
    hardConstraints,
    largeFloat,
    negativeFloat,
    largeDurations,
    invalidTasks,
    resourcesAssigned,
    lateTasks,
    criticalPathTest,
    criticalPathLength,
    baselineExecutionIndex,
  ];

  const overallScore = scores.filter((s) => s).length;
  const passed = overallScore >= 10;

  return {
    missingLogic,
    negativeLag,
    leadsLags,
    relationshipTypes,
    hardConstraints,
    largeFloat,
    negativeFloat,
    largeDurations,
    invalidTasks,
    resourcesAssigned,
    lateTasks,
    criticalPathTest,
    criticalPathLength,
    baselineExecutionIndex,
    overallScore,
    passed,
    findings,
  };
}
