#!/usr/bin/env python3
"""
Parse Microsoft Project MPP files using MPXJ library
Outputs JSON format that can be consumed by Node.js
"""

import sys
import json
import os
import mpxj

def find_jvm_path():
    """Find the JVM library path"""
    # Try JAVA_HOME first
    java_home = os.environ.get('JAVA_HOME')
    if java_home:
        # Common JVM library locations relative to JAVA_HOME
        possible_paths = [
            os.path.join(java_home, 'lib', 'server', 'libjvm.so'),
            os.path.join(java_home, 'lib', 'openjdk', 'lib', 'server', 'libjvm.so'),
            os.path.join(java_home, 'jre', 'lib', 'amd64', 'server', 'libjvm.so'),
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
    
    # Try to find via which java
    try:
        import subprocess
        java_bin = subprocess.check_output(['which', 'java'], text=True).strip()
        # Resolve symlinks
        java_bin = os.path.realpath(java_bin)
        # Java is typically at JAVA_HOME/bin/java
        java_home = os.path.dirname(os.path.dirname(java_bin))
        
        possible_paths = [
            os.path.join(java_home, 'lib', 'server', 'libjvm.so'),
            os.path.join(java_home, 'lib', 'openjdk', 'lib', 'server', 'libjvm.so'),
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
    except:
        pass
    
    return None

def parse_mpp_file(file_path):
    """Parse MPP file and return project data as JSON"""
    try:
        # Import after JVM is started
        from org.mpxj.reader import UniversalProjectReader
        
        # Read the project file
        project_file = UniversalProjectReader().read(file_path)
        
        # Get project properties
        properties = project_file.getProjectProperties()
        
        # Extract project metadata
        project_data = {
            "name": str(properties.getProjectTitle() or properties.getSubject() or "Untitled Project"),
            "startDate": str(properties.getStartDate()) if properties.getStartDate() else None,
            "finishDate": str(properties.getFinishDate()) if properties.getFinishDate() else None,
            "projectManager": str(properties.getManager() or properties.getAuthor() or ""),
            "description": str(properties.getComments() or properties.getSubject() or "")
        }
        
        # Extract tasks
        tasks_data = []
        for task in project_file.getTasks():
            # Skip null tasks or tasks without names
            if not task or not task.getName():
                continue
            
            # Determine if this is a summary task
            is_summary = bool(task.getSummary()) if task.getSummary() is not None else False
            
            # Extract predecessors
            predecessors = []
            if task.getPredecessors():
                for pred in task.getPredecessors():
                    # Get the predecessor task from the Relation object
                    pred_task = pred.getTargetTask() if hasattr(pred, 'getTargetTask') else None
                    if not pred_task and hasattr(pred, 'getTaskUniqueID'):
                        # Alternative: get by unique ID
                        task_id = pred.getTaskUniqueID()
                        if task_id:
                            predecessors.append(str(task_id))
                    elif pred_task and pred_task.getUniqueID():
                        predecessors.append(str(pred_task.getUniqueID()))
            
            # Extract resources
            resources = []
            if task.getResourceAssignments():
                for assignment in task.getResourceAssignments():
                    resource = assignment.getResource()
                    if resource and resource.getName():
                        resources.append(str(resource.getName()))
            
            # Get duration in days
            duration_val = None
            if task.getDuration():
                duration_val = int(task.getDuration().getDuration())
            
            # Get total float/slack in days
            total_float = 0
            if task.getTotalSlack():
                total_float = float(task.getTotalSlack().getDuration())
            
            # Build task data
            task_data = {
                "name": str(task.getName()),
                "wbsCode": str(task.getWBS() or ""),
                "startDate": str(task.getStart()) if task.getStart() else None,
                "endDate": str(task.getFinish()) if task.getFinish() else None,
                "duration": duration_val,
                "percentComplete": str(task.getPercentageComplete() or 0),
                "predecessors": predecessors,
                "resources": resources,
                "isCriticalPath": bool(task.getCritical()) if task.getCritical() is not None else False,
                "totalFloat": total_float,
                "isMilestone": bool(task.getMilestone()) if task.getMilestone() is not None else False,
                "isSummary": is_summary
            }
            
            tasks_data.append(task_data)
        
        # Return combined result
        result = {
            "success": True,
            "project": project_data,
            "tasks": tasks_data
        }
        
        return result
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
    
    # Start the JVM with MPXJ classpath (required for MPXJ)
    if not mpxj.isJVMStarted():
        # Find JVM library path
        jvm_path = find_jvm_path()
        
        if jvm_path:
            # Start JVM with explicit path
            mpxj.startJVM(jvm_path)
        else:
            # Try default path (may fail)
            try:
                mpxj.startJVM()
            except Exception as e:
                print(json.dumps({
                    "success": False, 
                    "error": f"Could not start JVM: {str(e)}. Java may not be installed or JAVA_HOME not set correctly."
                }))
                sys.exit(1)
    
    try:
        file_path = sys.argv[1]
        result = parse_mpp_file(file_path)
        print(json.dumps(result))
    finally:
        # Shutdown JVM
        if mpxj.isJVMStarted():
            mpxj.shutdownJVM()

if __name__ == "__main__":
    main()
