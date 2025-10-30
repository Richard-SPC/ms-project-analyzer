import { Task, Project } from "@shared/schema";

export interface NecAnalysisResult {
  programmeDefined: boolean;
  acceptedProgramme: boolean;
  regularUpdates: boolean;
  earlyWarningsManaged: boolean;
  compensationEventsTracked: boolean;
  keyDatesIdentified: boolean;
  completionDateRealistic: boolean;
  resourcesAdequate: boolean;
  overallCompliant: boolean;
  findings: {
    [key: string]: {
      passed: boolean;
      details: string;
      count?: number;
      percentage?: number;
    };
  };
}

export function analyzeNecCompliance(
  project: Project,
  tasks: Task[]
): NecAnalysisResult {
  const findings: NecAnalysisResult["findings"] = {};
  
  // If no tasks, most checks will fail
  if (tasks.length === 0) {
    return {
      programmeDefined: false,
      acceptedProgramme: false,
      regularUpdates: false,
      earlyWarningsManaged: false,
      compensationEventsTracked: false,
      keyDatesIdentified: false,
      completionDateRealistic: false,
      resourcesAdequate: false,
      overallCompliant: false,
      findings: {
        noTasks: {
          passed: false,
          details: "No tasks found in project. Cannot perform NEC compliance analysis.",
        },
      },
    };
  }

  // 1. Is there a defined programme?
  // Check if project has start/end dates and tasks with dates
  const hasProjectDates = project.startDate && project.endDate;
  const tasksWithDates = tasks.filter(t => t.startDate && t.endDate);
  const datesCoverage = tasks.length > 0 ? (tasksWithDates.length / tasks.length) * 100 : 0;
  const programmeDefined = hasProjectDates && datesCoverage >= 90;
  
  findings.programmeDefined = {
    passed: programmeDefined,
    details: programmeDefined
      ? `Programme is defined with project dates and ${tasksWithDates.length} of ${tasks.length} tasks (${datesCoverage.toFixed(1)}%) have start/end dates.`
      : `Programme incomplete: ${!hasProjectDates ? 'Project dates missing. ' : ''}${tasksWithDates.length} of ${tasks.length} tasks (${datesCoverage.toFixed(1)}%) have dates (requires ≥90%).`,
    count: tasksWithDates.length,
    percentage: datesCoverage,
  };

  // 2. Has the programme been accepted?
  // Check if baseline dates exist or project is in active status
  const tasksWithBaseline = tasks.filter(t => {
    // In our schema we don't have explicit baseline fields, but we can check if tasks have proper dates
    // and the project is in active or completed status
    return t.startDate && t.endDate;
  });
  const hasBaseline = project.status === "active" || project.status === "completed";
  const baselineCoverage = tasks.length > 0 ? (tasksWithBaseline.length / tasks.length) * 100 : 0;
  const acceptedProgramme = hasBaseline && baselineCoverage >= 90;
  
  findings.acceptedProgramme = {
    passed: acceptedProgramme,
    details: acceptedProgramme
      ? `Programme appears accepted: Project status is "${project.status}" and ${tasksWithBaseline.length} of ${tasks.length} tasks (${baselineCoverage.toFixed(1)}%) have baseline dates.`
      : `Programme not fully accepted: Project status is "${project.status}" and ${tasksWithBaseline.length} of ${tasks.length} tasks (${baselineCoverage.toFixed(1)}%) have dates (requires ≥90%).`,
    count: tasksWithBaseline.length,
    percentage: baselineCoverage,
  };

  // 3. Are regular updates provided?
  // Check if tasks have progress tracking (percent complete values)
  const tasksWithProgress = tasks.filter(t => {
    const percentComplete = parseFloat(t.percentComplete?.toString() || "0");
    // Consider a task tracked if it has any progress value or is 0% (intentional tracking)
    return t.percentComplete !== null && t.percentComplete !== undefined;
  });
  const progressCoverage = tasks.length > 0 ? (tasksWithProgress.length / tasks.length) * 100 : 0;
  const regularUpdates = progressCoverage >= 80;
  
  findings.regularUpdates = {
    passed: regularUpdates,
    details: regularUpdates
      ? `Regular updates evident: ${tasksWithProgress.length} of ${tasks.length} tasks (${progressCoverage.toFixed(1)}%) have progress tracking.`
      : `Insufficient progress tracking: ${tasksWithProgress.length} of ${tasks.length} tasks (${progressCoverage.toFixed(1)}%) tracked (requires ≥80%).`,
    count: tasksWithProgress.length,
    percentage: progressCoverage,
  };

  // 4. Are early warnings properly managed?
  // Check for high float tasks and missed tasks (potential warning indicators)
  const highFloatTasks = tasks.filter(t => {
    const totalFloat = t.totalFloat || 0;
    return totalFloat > 44; // DCMA standard threshold
  });
  
  const now = new Date();
  const missedTasks = tasks.filter(t => {
    if (!t.endDate) return false;
    const percentComplete = parseFloat(t.percentComplete?.toString() || "0");
    return new Date(t.endDate) < now && percentComplete < 100;
  });
  
  const totalWarningTasks = highFloatTasks.length + missedTasks.length;
  const warningPercentage = tasks.length > 0 ? (totalWarningTasks / tasks.length) * 100 : 0;
  const earlyWarningsManaged = warningPercentage <= 15; // Allow up to 15% warning indicators
  
  findings.earlyWarningsManaged = {
    passed: earlyWarningsManaged,
    details: earlyWarningsManaged
      ? `Early warnings managed: ${totalWarningTasks} of ${tasks.length} tasks (${warningPercentage.toFixed(1)}%) show warning indicators (${highFloatTasks.length} high float, ${missedTasks.length} missed).`
      : `Early warnings need attention: ${totalWarningTasks} of ${tasks.length} tasks (${warningPercentage.toFixed(1)}%) show warning indicators (${highFloatTasks.length} high float, ${missedTasks.length} missed). Threshold is ≤15%.`,
    count: totalWarningTasks,
    percentage: warningPercentage,
  };

  // 5. Are compensation events tracked?
  // This is difficult to determine from schedule alone
  // We'll check if there are tasks with significant float that might represent contingency
  const contingencyTasks = tasks.filter(t => {
    const totalFloat = t.totalFloat || 0;
    return totalFloat > 10 && totalFloat <= 44; // Moderate float might indicate tracked contingencies
  });
  const contingencyPercentage = tasks.length > 0 ? (contingencyTasks.length / tasks.length) * 100 : 0;
  // This is a soft criterion - we'll pass if there's reasonable contingency in the schedule
  const compensationEventsTracked = contingencyPercentage >= 5 || tasks.length < 20;
  
  findings.compensationEventsTracked = {
    passed: compensationEventsTracked,
    details: compensationEventsTracked
      ? `Schedule includes contingency: ${contingencyTasks.length} of ${tasks.length} tasks (${contingencyPercentage.toFixed(1)}%) have moderate float for compensation events.`
      : `Limited contingency tracking: ${contingencyTasks.length} of ${tasks.length} tasks (${contingencyPercentage.toFixed(1)}%) have float for events (suggests ≥5% for larger projects).`,
    count: contingencyTasks.length,
    percentage: contingencyPercentage,
  };

  // 6. Are key dates identified?
  // Check for milestone tasks
  const milestoneTasks = tasks.filter(t => t.isMilestone);
  const hasSufficientMilestones = milestoneTasks.length >= Math.min(3, Math.ceil(tasks.length / 20));
  const keyDatesIdentified = hasSufficientMilestones;
  
  findings.keyDatesIdentified = {
    passed: keyDatesIdentified,
    details: keyDatesIdentified
      ? `Key dates identified: ${milestoneTasks.length} milestone tasks mark important dates.`
      : `Insufficient milestones: ${milestoneTasks.length} milestones found. Larger programmes should have at least ${Math.min(3, Math.ceil(tasks.length / 20))} key dates.`,
    count: milestoneTasks.length,
  };

  // 7. Is the completion date realistic?
  // Check if critical path length aligns with project end date
  const criticalPathTasks = tasks.filter(t => t.isCriticalPath);
  
  if (criticalPathTasks.length > 0 && project.endDate) {
    // Find the latest end date among critical path tasks
    const latestCriticalEnd = criticalPathTasks.reduce((latest, task) => {
      if (!task.endDate) return latest;
      const taskEnd = new Date(task.endDate);
      return taskEnd > latest ? taskEnd : latest;
    }, new Date(0));
    
    const projectEnd = new Date(project.endDate);
    const daysDifference = Math.abs((projectEnd.getTime() - latestCriticalEnd.getTime()) / (1000 * 60 * 60 * 24));
    const completionDateRealistic = daysDifference <= 30; // Allow 30 days variance
    
    findings.completionDateRealistic = {
      passed: completionDateRealistic,
      details: completionDateRealistic
        ? `Completion date realistic: Critical path end (${latestCriticalEnd.toLocaleDateString()}) aligns with project end (${projectEnd.toLocaleDateString()}) within ${daysDifference.toFixed(0)} days.`
        : `Completion date may be unrealistic: Critical path end (${latestCriticalEnd.toLocaleDateString()}) differs from project end (${projectEnd.toLocaleDateString()}) by ${daysDifference.toFixed(0)} days (threshold: ≤30 days).`,
    };
  } else {
    // If no critical path or project end date, check if project has end date
    const hasEndDate = !!project.endDate;
    findings.completionDateRealistic = {
      passed: hasEndDate,
      details: hasEndDate
        ? "Project has completion date defined, but critical path not identified for detailed validation."
        : "Cannot validate completion date: No project end date or critical path defined.",
    };
  }

  // 8. Are resources adequate?
  // Check if sufficient tasks have resources assigned
  const tasksWithResources = tasks.filter(t => t.resources && t.resources.length > 0);
  const resourceCoverage = tasks.length > 0 ? (tasksWithResources.length / tasks.length) * 100 : 0;
  const resourcesAdequate = resourceCoverage >= 80;
  
  findings.resourcesAdequate = {
    passed: resourcesAdequate,
    details: resourcesAdequate
      ? `Resources adequate: ${tasksWithResources.length} of ${tasks.length} tasks (${resourceCoverage.toFixed(1)}%) have assigned resources.`
      : `Insufficient resource allocation: ${tasksWithResources.length} of ${tasks.length} tasks (${resourceCoverage.toFixed(1)}%) have resources (requires ≥80%).`,
    count: tasksWithResources.length,
    percentage: resourceCoverage,
  };

  // Calculate overall compliance - all criteria must pass
  const allCriteria = [
    programmeDefined,
    acceptedProgramme,
    regularUpdates,
    earlyWarningsManaged,
    compensationEventsTracked,
    keyDatesIdentified,
    findings.completionDateRealistic.passed,
    resourcesAdequate,
  ];
  
  const overallCompliant = allCriteria.every(c => c === true);

  return {
    programmeDefined,
    acceptedProgramme,
    regularUpdates,
    earlyWarningsManaged,
    compensationEventsTracked,
    keyDatesIdentified,
    completionDateRealistic: findings.completionDateRealistic.passed,
    resourcesAdequate,
    overallCompliant,
    findings,
  };
}
