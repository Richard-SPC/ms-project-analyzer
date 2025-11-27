import xml2js from 'xml2js';
import type { InsertProject, InsertTask, InsertCalendarException } from '@shared/schema';

interface ParsedTask extends Omit<InsertTask, 'id' | 'projectId'> {
  uid?: string; // MS Project UID for mapping predecessors
}

export interface CalendarException {
  date?: Date; // Legacy
  startDate?: Date;
  endDate?: Date;
  name: string;
  calendarName?: string;
}

interface ParsedXmlData {
  project: Omit<InsertProject, 'id'>;
  tasks: ParsedTask[];
  exceptions: CalendarException[];
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
  // Try multiple field names for status date: StatusDate, CurrentDate, DataDate
  let statusDate = projectData.StatusDate || projectData.CurrentDate || projectData.DataDate
    ? new Date(projectData.StatusDate || projectData.CurrentDate || projectData.DataDate)
    : undefined;
  
  // Fallback: try to extract status date from filename (e.g., "filename 16-11-25.xml")
  if (!statusDate) {
    const dateMatch = fileName.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})\./);
    if (dateMatch) {
      const day = dateMatch[1];
      const month = dateMatch[2];
      let year = dateMatch[3];
      // Convert 2-digit year to 4-digit
      if (year.length === 2) {
        year = parseInt(year) < 50 ? '20' + year : '19' + year;
      }
      statusDate = new Date(`${year}-${month}-${day}`);
      console.log(`[XML Parser] Extracted status date from filename: ${statusDate}`);
    }
  }
  
  const projectManager = projectData.Manager || projectData.Author || '';
  
  console.log(`[XML Parser] Extracted project: ${projectName}, StatusDate: ${statusDate}`);

  const project: Omit<InsertProject, 'id'> = {
    name: projectName,
    description: projectData.Comments || projectData.Subject || '',
    projectManager,
    status: 'active',
    startDate,
    endDate: finishDate,
    statusDate,
  };

  // First, build a map of resources by UID
  // Extract calendar exceptions (holidays/non-working days)
  const exceptions: CalendarException[] = [];
  if (projectData.Calendars && projectData.Calendars.Calendar) {
    const calendars = Array.isArray(projectData.Calendars.Calendar)
      ? projectData.Calendars.Calendar
      : [projectData.Calendars.Calendar];
    
    for (const calendar of calendars) {
      const calendarName = String(calendar.Name || 'Standard Calendar');
      
      // Skip the baseline calendar
      if (calendarName === 'Used for Microsoft Project 98 Baseline Calendar') {
        continue;
      }
      
      // Look for exceptions in the calendar
      if (calendar.Exceptions && calendar.Exceptions.Exception) {
        const exceptionList = Array.isArray(calendar.Exceptions.Exception)
          ? calendar.Exceptions.Exception
          : [calendar.Exceptions.Exception];
        
        for (const exc of exceptionList) {
          try {
            // Check if this is a non-working day (DayWorking = 0)
            const dayWorking = exc.DayWorking ? parseInt(String(exc.DayWorking)) : 1;
            if (dayWorking !== 0) continue; // Skip working days
            
            console.log(`[XML Parser] Exception: ${exc.Name}`, JSON.stringify(exc, null, 2));
            
            // Microsoft Project stores exception dates in TimePeriod.FromDate and ToDate
            // TimePeriod can be an array or single object
            let startDate: Date | undefined;
            let endDate: Date | undefined;
            
            if (exc.TimePeriod) {
              const timePeriods = Array.isArray(exc.TimePeriod) ? exc.TimePeriod : [exc.TimePeriod];
              
              // Use the first time period (or could iterate if there are multiple)
              const tp = timePeriods[0];
              
              if (tp.FromDate) {
                const fromDateStr = String(tp.FromDate);
                // Parse as UTC date - only extract YYYY-MM-DD portion
                const dateMatch = fromDateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (dateMatch) {
                  const [, year, month, day] = dateMatch;
                  startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
                } else {
                  startDate = new Date(fromDateStr);
                }
                console.log(`[XML Parser]   FromDate: ${fromDateStr} -> ${startDate.toISOString()}`);
              }
              if (tp.ToDate) {
                const toDateStr = String(tp.ToDate);
                // Parse as UTC date - only extract YYYY-MM-DD portion
                const dateMatch = toDateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (dateMatch) {
                  const [, year, month, day] = dateMatch;
                  endDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));
                } else {
                  endDate = new Date(toDateStr);
                }
                console.log(`[XML Parser]   ToDate: ${toDateStr} -> ${endDate.toISOString()}`);
              }
            }
            
            // Use the parsed dates (which are now in UTC at midnight/end-of-day)
            if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              // Reset to midnight UTC for both (endDate was set to 23:59:59, reset it)
              const startNorm = new Date(startDate);
              const endNorm = new Date(endDate);
              startNorm.setUTCHours(0, 0, 0, 0);
              endNorm.setUTCHours(0, 0, 0, 0);
              
              const excName = exc.Name || `Non-working day`;
              const daysDiff = Math.floor((endNorm.getTime() - startNorm.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              console.log(`[XML Parser]   ✓ Adding: ${excName} from ${startNorm.toISOString().split('T')[0]} to ${endNorm.toISOString().split('T')[0]} (${daysDiff} days)`);
              
              exceptions.push({
                startDate: startNorm,
                endDate: endNorm,
                name: excName,
                calendarName: calendarName,
              } as CalendarException);
            } else {
              console.log(`[XML Parser]   ✗ No valid dates found`);
            }
          } catch (e) {
            console.log(`[XML Parser] Error parsing exception:`, e);
          }
        }
      }
    }
  }
  
  if (exceptions.length > 0) {
    console.log(`[XML Parser] Found ${exceptions.length} calendar exceptions`);
  }

  const resourceMap = new Map<string, string>();
  if (projectData.Resources && projectData.Resources.Resource) {
    const resourceList = Array.isArray(projectData.Resources.Resource)
      ? projectData.Resources.Resource
      : [projectData.Resources.Resource];
    
    for (const resource of resourceList) {
      if (resource.UID && resource.Name) {
        resourceMap.set(String(resource.UID), String(resource.Name));
      }
    }
  }
  
  // Second, build a map of task assignments (TaskUID -> ResourceNames[])
  const taskAssignments = new Map<string, string[]>();
  if (projectData.Assignments && projectData.Assignments.Assignment) {
    const assignmentList = Array.isArray(projectData.Assignments.Assignment)
      ? projectData.Assignments.Assignment
      : [projectData.Assignments.Assignment];
    
    for (const assignment of assignmentList) {
      if (assignment.TaskUID && assignment.ResourceUID) {
        const taskUid = String(assignment.TaskUID);
        const resourceUid = String(assignment.ResourceUID);
        const resourceName = resourceMap.get(resourceUid);
        
        if (resourceName) {
          if (!taskAssignments.has(taskUid)) {
            taskAssignments.set(taskUid, []);
          }
          taskAssignments.get(taskUid)!.push(resourceName);
        }
      }
    }
  }
  
  console.log('[XML Parser] Found resources:', resourceMap.size);
  console.log('[XML Parser] Found task assignments:', taskAssignments.size);
  if (taskAssignments.size > 0) {
    console.log('[XML Parser] Sample assignments:', Array.from(taskAssignments.entries()).slice(0, 5));
  }

  // Extract tasks
  const tasks: ParsedTask[] = [];
  
  if (projectData.Tasks && projectData.Tasks.Task) {
    const taskList = Array.isArray(projectData.Tasks.Task) 
      ? projectData.Tasks.Task 
      : [projectData.Tasks.Task];

    for (const xmlTask of taskList) {
      // Skip null tasks
      if (!xmlTask || !xmlTask.Name) continue;
      
      // Extract MS Project UID for mapping predecessors later
      const uid = xmlTask.UID ? String(xmlTask.UID) : undefined;
      
      // Extract MS Project ID (row number) for display
      const msProjectId = xmlTask.ID ? String(xmlTask.ID) : undefined;
      
      // Detect if this is a summary task
      const isSummary = xmlTask.Summary === '1' || xmlTask.Summary === 'true' || xmlTask.Summary === true;

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

      // Parse predecessors with lag information
      // Format: "UID-Type-Lag" (e.g., "123-FS-2d" or "456-SS+5d")
      const predecessors: string[] = [];
      if (xmlTask.PredecessorLink) {
        const predList = Array.isArray(xmlTask.PredecessorLink)
          ? xmlTask.PredecessorLink
          : [xmlTask.PredecessorLink];
        
        for (const pred of predList) {
          if (pred.PredecessorUID) {
            const predUid = String(pred.PredecessorUID);
            
            // Parse relationship type (0=FF, 1=FS, 2=SF, 3=SS per MS documentation)
            const typeMap: { [key: string]: string } = {
              '0': 'FF',
              '1': 'FS',
              '2': 'SF',
              '3': 'SS'
            };
            const typeCode = pred.Type ? String(pred.Type) : '1'; // Default to FS
            const type = typeMap[typeCode] || 'FS';
            
            // Debug logging for relationship types
            if (msProjectId && ['38', '39', '40', '41', '94'].includes(msProjectId)) {
              console.log(`[XML Parser] Task ${msProjectId}: PredecessorLink Type=${typeCode} -> ${type}`);
            }
            
            // Parse lag - MS Project ALWAYS stores LinkLag in tenths of minutes
            // Regardless of LagFormat. LagFormat is for display only.
            // 4800 = 8 hours/day * 60 minutes/hour * 10 (tenths of minutes)
            let lagDays = 0;
            if (pred.LinkLag) {
              const lagValue = parseInt(String(pred.LinkLag)) || 0;
              // Always divide by 4800 to convert tenths-of-minutes to days
              lagDays = lagValue / 4800;
              // Keep full precision to ensure small non-zero lags are detected
              // Round to 4 decimal places only for storage
              lagDays = Math.round(lagDays * 10000) / 10000;
            }
            
            // Format: "UID|Type|Lag" using pipe to avoid conflicts with negative numbers
            // (e.g., "123|FS|2" or "456|SS|-5" or "789|FS|0")
            predecessors.push(`${predUid}|${type}|${lagDays}`);
          }
        }
      }

      // Parse constraint type
      // MS Project ConstraintType: 0=ASAP, 1=ALAP, 2=MSO, 3=MFO, 4=SNET, 5=SNLT, 6=FNET, 7=FNLT
      let constraintType: string | undefined;
      if (xmlTask.ConstraintType !== undefined) {
        const constraintMap: { [key: string]: string } = {
          '0': 'ASAP',  // As Soon As Possible (flexible)
          '1': 'ALAP',  // As Late As Possible (flexible)
          '2': 'MSO',   // Must Start On (HARD)
          '3': 'MFO',   // Must Finish On (HARD)
          '4': 'SNET',  // Start No Earlier Than (HARD)
          '5': 'SNLT',  // Start No Later Than (HARD)
          '6': 'FNET',  // Finish No Earlier Than (HARD)
          '7': 'FNLT',  // Finish No Later Than (HARD)
        };
        const constraintCode = String(xmlTask.ConstraintType);
        constraintType = constraintMap[constraintCode];
      }

      // Parse resources - look up from assignments map by task UID
      const resources: string[] = uid ? (taskAssignments.get(uid) || []) : [];

      // Parse percent complete
      const percentComplete = xmlTask.PercentComplete 
        ? parseFloat(String(xmlTask.PercentComplete)) 
        : 0;

      // Parse total slack/float - MS Project stores TotalSlack in tenths of minutes
      // Same conversion as lag: divide by 4800 to convert to days
      let totalFloat: number | undefined;
      if (xmlTask.TotalSlack) {
        const totalSlackValue = parseInt(String(xmlTask.TotalSlack)) || 0;
        totalFloat = totalSlackValue / 4800;
      }

      tasks.push({
        uid, // Store MS Project UID temporarily for mapping predecessors
        msProjectId, // Store MS Project ID (row number) for reference
        name: String(xmlTask.Name),
        wbsCode: xmlTask.WBS ? String(xmlTask.WBS) : undefined,
        duration,
        startDate: taskStart,
        endDate: taskFinish,
        percentComplete: percentComplete.toString(),
        predecessors: predecessors.length > 0 ? predecessors : undefined,
        resources: resources.length > 0 ? resources : undefined,
        isCriticalPath: xmlTask.Critical === '1' || xmlTask.Critical === 'true' || xmlTask.Critical === true,
        totalFloat,
        isMilestone: xmlTask.Milestone === '1' || xmlTask.Milestone === 'true' || xmlTask.Milestone === true,
        isSummary,
        constraintType,
      });
    }
  }

  return { project, tasks, exceptions };
}
