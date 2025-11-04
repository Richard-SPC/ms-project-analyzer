#!/usr/bin/env python3
"""
Parse Microsoft Project MPP files using MPXJ library
Outputs JSON format that can be consumed by Node.js
"""

import sys
import json
from mpxj import ProjectReader

def parse_mpp_file(file_path):
    """Parse MPP file and return project data as JSON"""
    try:
        # Read the project file
        project = ProjectReader(file_path)
        
        # Extract project metadata
        project_data = {
            "name": project.project_properties.get("project_title") or project.project_properties.get("subject") or "Untitled Project",
            "startDate": str(project.project_properties.get("start_date")) if project.project_properties.get("start_date") else None,
            "finishDate": str(project.project_properties.get("finish_date")) if project.project_properties.get("finish_date") else None,
            "projectManager": project.project_properties.get("manager") or project.project_properties.get("author") or "",
            "description": project.project_properties.get("comments") or project.project_properties.get("subject") or ""
        }
        
        # Extract tasks
        tasks_data = []
        for task in project.tasks:
            # Skip null tasks or tasks without names
            if not task or not task.name:
                continue
            
            # Determine if this is a summary task
            is_summary = task.summary if hasattr(task, 'summary') else False
            
            # Extract predecessors
            predecessors = []
            if task.predecessors:
                for pred in task.predecessors:
                    if pred.source_task and pred.source_task.unique_id:
                        predecessors.append(str(pred.source_task.unique_id))
            
            # Extract resources
            resources = []
            if task.resource_assignments:
                for assignment in task.resource_assignments:
                    if assignment.resource and assignment.resource.name:
                        resources.append(assignment.resource.name)
            
            # Build task data
            task_data = {
                "name": task.name,
                "wbsCode": task.wbs or "",
                "startDate": str(task.start) if task.start else None,
                "endDate": str(task.finish) if task.finish else None,
                "duration": int(task.duration.days) if task.duration else None,
                "percentComplete": str(task.percent_complete) if task.percent_complete is not None else "0",
                "predecessors": predecessors,
                "resources": resources,
                "isCriticalPath": task.critical if hasattr(task, 'critical') else False,
                "totalFloat": float(task.total_slack.days) if task.total_slack else 0,
                "isMilestone": task.milestone if hasattr(task, 'milestone') else False,
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
        return {
            "success": False,
            "error": str(e)
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = parse_mpp_file(file_path)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
