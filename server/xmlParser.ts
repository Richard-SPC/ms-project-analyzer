import xml2js from 'xml2js';
import type { InsertProject, InsertTask } from '@shared/schema';

interface ParsedXmlData {
  project: Omit<InsertProject, 'id'>;
  tasks: Omit<InsertTask, 'id' | 'projectId'>[];
}

/**
 * Parse Microsoft Project XML file and extract project and task data
 */
export async function parseProjectXml(xmlContent: string, fileName: string): Promise<ParsedXmlData> {
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xmlContent);

  const projectData = result.Project;
  
  if (!projectData) {
    throw new Error('Invalid Microsoft Project XML format: Missing Project element');
  }

  // Extract project information
  const projectName = projectData.Name || projectData.Title || fileName.replace(/\.xml$/i, '');
  const startDate = projectData.StartDate ? new Date(projectData.StartDate) : new Date();
  const finishDate = projectData.FinishDate ? new Date(projectData.FinishDate) : undefined;
  const projectManager = projectData.Manager || projectData.Author || '';

  const project: Omit<InsertProject, 'id'> = {
    name: projectName,
    description: projectData.Comments || projectData.Subject || '',
    projectManager,
    status: 'active',
    startDate,
    endDate: finishDate,
  };

  // Extract tasks
  const tasks: Omit<InsertTask, 'id' | 'projectId'>[] = [];
  
  if (projectData.Tasks && projectData.Tasks.Task) {
    const taskList = Array.isArray(projectData.Tasks.Task) 
      ? projectData.Tasks.Task 
      : [projectData.Tasks.Task];

    for (const xmlTask of taskList) {
      // Skip summary tasks (those with children) or null tasks
      if (!xmlTask || !xmlTask.Name) continue;

      // Parse task dates
      const taskStart = xmlTask.Start ? new Date(xmlTask.Start) : undefined;
      const taskFinish = xmlTask.Finish ? new Date(xmlTask.Finish) : undefined;
      
      // Parse duration (MS Project stores duration in PT format or as days)
      let duration: number | undefined;
      if (xmlTask.Duration) {
        const durationStr = String(xmlTask.Duration);
        // Handle ISO 8601 duration format (PT8H0M0S) or simple numbers
        if (durationStr.includes('PT')) {
          const hours = durationStr.match(/(\d+)H/);
          duration = hours ? Math.ceil(parseInt(hours[1]) / 8) : undefined;
        } else {
          duration = parseInt(durationStr) || undefined;
        }
      }

      // Parse predecessors
      const predecessors: string[] = [];
      if (xmlTask.PredecessorLink) {
        const predList = Array.isArray(xmlTask.PredecessorLink)
          ? xmlTask.PredecessorLink
          : [xmlTask.PredecessorLink];
        
        for (const pred of predList) {
          if (pred.PredecessorUID) {
            predecessors.push(String(pred.PredecessorUID));
          }
        }
      }

      // Parse resources
      const resources: string[] = [];
      if (xmlTask.Assignment) {
        const assignments = Array.isArray(xmlTask.Assignment)
          ? xmlTask.Assignment
          : [xmlTask.Assignment];
        
        for (const assignment of assignments) {
          if (assignment.ResourceName) {
            resources.push(String(assignment.ResourceName));
          }
        }
      }

      // Parse percent complete
      const percentComplete = xmlTask.PercentComplete 
        ? parseFloat(String(xmlTask.PercentComplete)) 
        : 0;

      tasks.push({
        name: String(xmlTask.Name),
        wbsCode: xmlTask.WBS ? String(xmlTask.WBS) : undefined,
        duration,
        startDate: taskStart,
        endDate: taskFinish,
        percentComplete: percentComplete.toString(),
        predecessors: predecessors.length > 0 ? predecessors : undefined,
        resources: resources.length > 0 ? resources : undefined,
        isCriticalPath: xmlTask.Critical === '1' || xmlTask.Critical === 'true' || xmlTask.Critical === true,
        totalFloat: xmlTask.TotalSlack ? parseInt(String(xmlTask.TotalSlack)) : undefined,
        isMilestone: xmlTask.Milestone === '1' || xmlTask.Milestone === 'true' || xmlTask.Milestone === true,
      });
    }
  }

  return { project, tasks };
}
