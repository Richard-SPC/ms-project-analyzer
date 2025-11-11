import * as xlsx from 'xlsx';
import type { InsertProject, InsertTask } from '@shared/schema';

interface ExcelParseResult {
  success: boolean;
  project?: InsertProject;
  tasks?: Omit<InsertTask, 'id' | 'projectId'>[];
  error?: string;
}

interface ExcelRow {
  [key: string]: any;
}

/**
 * Parse Excel/CSV project file
 * Expected columns:
 * - Task ID / ID / UniqueID
 * - Task Name / Name
 * - WBS (optional)
 * - Start Date / Start
 * - Finish Date / Finish / End Date
 * - Duration
 * - % Complete / Percent Complete
 * - Predecessors
 * - Resource Names / Resources
 * - Critical (Yes/No or True/False)
 * - Total Slack / Total Float / Float
 * - Milestone (Yes/No or True/False)
 * - Summary (Yes/No or True/False)
 */
export async function parseExcelFile(filePath: string, fileName: string): Promise<ExcelParseResult> {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rows: ExcelRow[] = xlsx.utils.sheet_to_json(worksheet);
    
    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: 'No data found in Excel file'
      };
    }
    
    // Detect column names (case-insensitive)
    const headers = Object.keys(rows[0]);
    const columnMap = detectColumnNames(headers);
    
    if (!columnMap.taskName) {
      return {
        success: false,
        error: 'Could not find Task Name column. Expected columns: Task Name, Start Date, Finish Date, etc.'
      };
    }
    
    // Extract project metadata from first row
    const firstRow = rows[0];
    const projectName = extractProjectName(fileName, rows, columnMap);
    const dates = extractDateRange(rows, columnMap);
    
    const project: InsertProject = {
      name: projectName,
      startDate: dates.startDate ? new Date(dates.startDate) : undefined,
      endDate: dates.finishDate ? new Date(dates.finishDate) : undefined,
      projectManager: '',
      description: `Imported from ${fileName}`,
      necCompliant: false
    };
    
    // Parse tasks
    const tasks: Omit<InsertTask, 'id' | 'projectId'>[] = [];
    
    for (const row of rows) {
      // Skip empty rows
      if (!row[columnMap.taskName]) {
        continue;
      }
      
      const taskName = String(row[columnMap.taskName] || '').trim();
      if (!taskName) {
        continue;
      }
      
      // Parse dates
      const startDate = parseExcelDate(row[columnMap.startDate]);
      const endDate = parseExcelDate(row[columnMap.endDate]);
      
      // Parse duration (could be "5 days" or just "5")
      const durationStr = String(row[columnMap.duration] || '0');
      const duration = parseDuration(durationStr);
      
      // Parse percent complete
      const percentStr = String(row[columnMap.percentComplete] || '0');
      const percentComplete = parsePercentage(percentStr);
      
      // Parse predecessors (could be "1,2,3" or "1FS,2SS")
      const predecessorsStr = String(row[columnMap.predecessors] || '');
      const predecessors = parsePredecessors(predecessorsStr);
      
      // Parse resources (could be "John,Jane" or "John; Jane")
      const resourcesStr = String(row[columnMap.resources] || '');
      const resources = parseResources(resourcesStr);
      
      // Parse boolean fields
      const isCriticalPath = parseBoolean(row[columnMap.critical]);
      const isMilestone = parseBoolean(row[columnMap.milestone]);
      const isSummary = parseBoolean(row[columnMap.summary]);
      
      // Parse total float
      const totalFloatStr = String(row[columnMap.totalFloat] || '0');
      const totalFloat = parseFloat(totalFloatStr.replace(/[^0-9.-]/g, '')) || 0;
      
      const task: Omit<InsertTask, 'id' | 'projectId'> = {
        name: taskName,
        wbsCode: String(row[columnMap.wbs] || ''),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        duration,
        percentComplete,
        predecessors,
        resources,
        isCriticalPath,
        totalFloat,
        isMilestone,
        isSummary
      };
      
      tasks.push(task);
    }
    
    if (tasks.length === 0) {
      return {
        success: false,
        error: 'No valid tasks found in Excel file'
      };
    }
    
    return {
      success: true,
      project,
      tasks
    };
    
  } catch (error) {
    console.error('Excel parsing error:', error);
    return {
      success: false,
      error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Detect column names from headers (case-insensitive)
 */
function detectColumnNames(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // Task ID
  const idCandidates = ['task id', 'id', 'uniqueid', 'unique id', 'task_id'];
  map.taskId = findHeader(headers, lowerHeaders, idCandidates);
  
  // Task Name
  const nameCandidates = ['task name', 'name', 'task_name', 'activity', 'activity name'];
  map.taskName = findHeader(headers, lowerHeaders, nameCandidates);
  
  // WBS
  const wbsCandidates = ['wbs', 'wbs code', 'outline number'];
  map.wbs = findHeader(headers, lowerHeaders, wbsCandidates);
  
  // Start Date
  const startCandidates = ['start date', 'start', 'start_date', 'begin date'];
  map.startDate = findHeader(headers, lowerHeaders, startCandidates);
  
  // End Date
  const endCandidates = ['finish date', 'finish', 'end date', 'end', 'finish_date', 'end_date'];
  map.endDate = findHeader(headers, lowerHeaders, endCandidates);
  
  // Duration
  const durationCandidates = ['duration', 'dur'];
  map.duration = findHeader(headers, lowerHeaders, durationCandidates);
  
  // Percent Complete
  const percentCandidates = ['% complete', 'percent complete', 'complete', '% comp', 'pct complete'];
  map.percentComplete = findHeader(headers, lowerHeaders, percentCandidates);
  
  // Predecessors
  const predCandidates = ['predecessors', 'pred', 'dependencies'];
  map.predecessors = findHeader(headers, lowerHeaders, predCandidates);
  
  // Resources
  const resourceCandidates = ['resource names', 'resources', 'assigned to', 'resource'];
  map.resources = findHeader(headers, lowerHeaders, resourceCandidates);
  
  // Critical
  const criticalCandidates = ['critical', 'crit', 'is critical'];
  map.critical = findHeader(headers, lowerHeaders, criticalCandidates);
  
  // Total Float
  const floatCandidates = ['total slack', 'total float', 'float', 'slack', 'total_slack'];
  map.totalFloat = findHeader(headers, lowerHeaders, floatCandidates);
  
  // Milestone
  const milestoneCandidates = ['milestone', 'is milestone'];
  map.milestone = findHeader(headers, lowerHeaders, milestoneCandidates);
  
  // Summary
  const summaryCandidates = ['summary', 'is summary', 'issummary'];
  map.summary = findHeader(headers, lowerHeaders, summaryCandidates);
  
  return map;
}

function findHeader(headers: string[], lowerHeaders: string[], candidates: string[]): string {
  for (const candidate of candidates) {
    const index = lowerHeaders.indexOf(candidate);
    if (index !== -1) {
      return headers[index];
    }
  }
  return '';
}

/**
 * Extract project name from filename or first task
 */
function extractProjectName(fileName: string, rows: ExcelRow[], columnMap: Record<string, string>): string {
  // Remove file extension
  let name = fileName.replace(/\.(xlsx?|csv)$/i, '');
  
  // If filename is generic, try to use first summary task
  if (name.toLowerCase() === 'export' || name.toLowerCase() === 'project') {
    const firstSummary = rows.find(row => parseBoolean(row[columnMap.summary]));
    if (firstSummary && firstSummary[columnMap.taskName]) {
      name = String(firstSummary[columnMap.taskName]);
    }
  }
  
  return name;
}

/**
 * Extract date range from all tasks
 */
function extractDateRange(rows: ExcelRow[], columnMap: Record<string, string>): { startDate: string | null, finishDate: string | null } {
  let earliestStart: Date | null = null;
  let latestFinish: Date | null = null;
  
  for (const row of rows) {
    const start = parseExcelDate(row[columnMap.startDate]);
    const finish = parseExcelDate(row[columnMap.endDate]);
    
    if (start) {
      const startDate = new Date(start);
      if (!earliestStart || startDate < earliestStart) {
        earliestStart = startDate;
      }
    }
    
    if (finish) {
      const finishDate = new Date(finish);
      if (!latestFinish || finishDate > latestFinish) {
        latestFinish = finishDate;
      }
    }
  }
  
  return {
    startDate: earliestStart ? earliestStart.toISOString() : null,
    finishDate: latestFinish ? latestFinish.toISOString() : null
  };
}

/**
 * Parse Excel date (could be serial number or string)
 */
function parseExcelDate(value: any): string | null {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // If it's an Excel serial number
  if (typeof value === 'number') {
    // Excel dates are days since 1900-01-01 (with leap year bug)
    const date = xlsx.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d).toISOString();
    }
  }
  
  // Try to parse as string
  const str = String(value).trim();
  if (str) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  
  return null;
}

/**
 * Parse duration (could be "5 days" or just "5")
 */
function parseDuration(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Parse percentage (could be "75%" or "0.75" or "75")
 */
function parsePercentage(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return '0';
  
  // If it's a decimal (0.75), convert to percentage
  if (num <= 1) {
    return String(Math.round(num * 100));
  }
  
  // Otherwise it's already a percentage
  return String(Math.round(num));
}

/**
 * Parse predecessors (could be "1,2,3" or "1FS,2SS" or "1; 2; 3")
 */
function parsePredecessors(value: string): string[] {
  if (!value) return [];
  
  // Split by comma or semicolon
  const parts = value.split(/[,;]/).map(p => p.trim());
  
  const predecessors: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    
    // Remove dependency type (FS, SS, FF, SF)
    const cleaned = part.replace(/[A-Z]{2}$/i, '').trim();
    if (cleaned) {
      predecessors.push(cleaned);
    }
  }
  
  return predecessors;
}

/**
 * Parse resources (could be "John,Jane" or "John; Jane")
 */
function parseResources(value: string): string[] {
  if (!value) return [];
  
  // Split by comma or semicolon
  return value.split(/[,;]/)
    .map(r => r.trim())
    .filter(r => r.length > 0);
}

/**
 * Parse boolean (could be "Yes", "No", "True", "False", 1, 0)
 */
function parseBoolean(value: any): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  
  const str = String(value).toLowerCase().trim();
  return str === 'yes' || str === 'true' || str === '1';
}
