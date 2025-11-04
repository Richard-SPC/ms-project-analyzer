/**
 * MPP File Parser
 * 
 * Parses Microsoft Project MPP files using MPXJ Python library
 */

import { spawn, execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import type { InsertProject, InsertTask } from '@shared/schema';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MppParseResult {
  success: boolean;
  message?: string;
  project?: Omit<InsertProject, 'id'>;
  tasks?: Omit<InsertTask, 'id' | 'projectId'>[];
  fileName: string;
  fileSize: number;
}

interface PythonParseResult {
  success: boolean;
  error?: string;
  project?: {
    name: string;
    startDate: string | null;
    finishDate: string | null;
    projectManager: string;
    description: string;
  };
  tasks?: Array<{
    name: string;
    wbsCode: string;
    startDate: string | null;
    endDate: string | null;
    duration: number | null;
    percentComplete: string;
    predecessors: string[];
    resources: string[];
    isCriticalPath: boolean;
    totalFloat: number;
    isMilestone: boolean;
    isSummary: boolean;
  }>;
}

/**
 * Parse MPP file buffer using MPXJ Python library
 */
export async function parseMppFile(buffer: Buffer, fileName: string): Promise<MppParseResult> {
  let tempFilePath: string | null = null;
  
  try {
    // Validate MPP file signature
    const signature = buffer.slice(0, 8);
    const oleSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    
    if (!signature.equals(oleSignature)) {
      return {
        success: false,
        message: "Invalid MPP file format. File does not appear to be a valid Microsoft Project file.",
        fileName,
        fileSize: buffer.length,
      };
    }

    // Write buffer to temporary file
    const tempFileName = `${Date.now()}-${fileName}`;
    tempFilePath = join(tmpdir(), tempFileName);
    writeFileSync(tempFilePath, buffer);

    // Call Python script to parse MPP file
    const pythonResult = await callPythonParser(tempFilePath);

    // Clean up temp file
    unlinkSync(tempFilePath);
    tempFilePath = null;

    if (!pythonResult.success) {
      return {
        success: false,
        message: `Failed to parse MPP file: ${pythonResult.error || "Unknown error"}`,
        fileName,
        fileSize: buffer.length,
      };
    }

    // Convert Python result to our format
    if (!pythonResult.project || !pythonResult.tasks) {
      return {
        success: false,
        message: "MPP file parsed but no project data found",
        fileName,
        fileSize: buffer.length,
      };
    }

    const project: Omit<InsertProject, 'id'> = {
      name: pythonResult.project.name || fileName.replace(/\.mpp$/i, ''),
      description: pythonResult.project.description || '',
      projectManager: pythonResult.project.projectManager || '',
      status: 'active',
      startDate: pythonResult.project.startDate ? new Date(pythonResult.project.startDate) : new Date(),
      endDate: pythonResult.project.finishDate ? new Date(pythonResult.project.finishDate) : undefined,
    };

    const tasks: Omit<InsertTask, 'id' | 'projectId'>[] = pythonResult.tasks.map(task => ({
      name: task.name,
      wbsCode: task.wbsCode,
      startDate: task.startDate ? new Date(task.startDate) : undefined,
      endDate: task.endDate ? new Date(task.endDate) : undefined,
      duration: task.duration,
      percentComplete: task.percentComplete,
      predecessors: task.predecessors,
      resources: task.resources,
      isCriticalPath: task.isCriticalPath,
      totalFloat: task.totalFloat,
      isMilestone: task.isMilestone,
      isSummary: task.isSummary,
    }));

    return {
      success: true,
      project,
      tasks,
      fileName,
      fileSize: buffer.length,
    };

  } catch (error) {
    // Clean up temp file if it exists
    if (tempFilePath) {
      try {
        unlinkSync(tempFilePath);
      } catch {}
    }

    return {
      success: false,
      message: `Error processing MPP file: ${error instanceof Error ? error.message : "Unknown error"}`,
      fileName,
      fileSize: buffer.length,
    };
  }
}

/**
 * Call Python parser script
 */
async function callPythonParser(filePath: string): Promise<PythonParseResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, 'parseMpp.py');
    
    // Set JAVA_HOME for jpype to find the JVM
    // On Nix/Replit, Java is installed via nix and we need to locate it
    let javaHome = process.env.JAVA_HOME;
    
    if (!javaHome) {
      try {
        const javaPath = execSync('which java', { encoding: 'utf-8' }).trim();
        // Java binary is at /path/to/java/bin/java, so JAVA_HOME is two levels up
        const javaBin = dirname(javaPath);
        javaHome = dirname(javaBin);
      } catch (error) {
        // If we can't find Java, let the Python script fail with a clear error
        console.warn('Could not locate Java installation');
      }
    }
    
    const env = {
      ...process.env,
      ...(javaHome && { JAVA_HOME: javaHome }),
    };
    
    const pythonProcess = spawn('python3', [scriptPath, filePath], { env });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: `Python parser exited with code ${code}: ${stderr}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse Python output: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    });

    pythonProcess.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to spawn Python process: ${error.message}`,
      });
    });
  });
}

/**
 * Extract project name from file name
 */
export function getProjectNameFromFileName(fileName: string): string {
  return fileName
    .replace(/\.(mpp|xml)$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
