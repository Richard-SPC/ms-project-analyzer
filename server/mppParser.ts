/**
 * MPP File Parser
 * 
 * Microsoft Project MPP files are proprietary binary formats.
 * This parser provides basic file validation and metadata extraction.
 * For full parsing, users should export to XML format from MS Project.
 */

interface MppParseResult {
  success: boolean;
  message: string;
  projectName?: string;
  fileName: string;
  fileSize: number;
  tasks?: any[];
}

/**
 * Parse MPP file buffer
 * 
 * Note: Full MPP parsing requires Java-based libraries (MPXJ) or commercial APIs.
 * This function validates the file and provides guidance for conversion to XML.
 */
export async function parseMppFile(buffer: Buffer, fileName: string): Promise<MppParseResult> {
  try {
    // Check if it's actually an MPP file by looking at the file signature
    // MPP files are OLE2/CFB (Compound File Binary) format
    const signature = buffer.slice(0, 8);
    const oleSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    
    const isValidMpp = signature.equals(oleSignature);
    
    if (!isValidMpp) {
      return {
        success: false,
        message: "Invalid MPP file format. File does not appear to be a valid Microsoft Project file.",
        fileName,
        fileSize: buffer.length,
      };
    }

    // MPP files are complex binary formats that require specialized parsers
    // Provide a helpful message to users
    return {
      success: false,
      message: `MPP file detected: "${fileName}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB).

⚠️  Full MPP parsing requires additional dependencies not currently installed.

📝 To import this project, please convert it to XML format in Microsoft Project:
   1. Open your project in Microsoft Project
   2. File → Save As
   3. Choose "XML Format (*.xml)" from the file type dropdown
   4. Save and upload the XML file

The XML format contains all the same project data (tasks, dates, dependencies, resources) and is fully supported by this application.`,
      fileName,
      fileSize: buffer.length,
    };

  } catch (error) {
    return {
      success: false,
      message: `Error processing MPP file: ${error instanceof Error ? error.message : "Unknown error"}`,
      fileName,
      fileSize: buffer.length,
    };
  }
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
