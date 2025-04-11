from .config import celery_app
from src.utils.logger import logger
from typing import Dict, Any
from datetime import datetime

@celery_app.task(name='src.celery.tasks.process_schedule')
def process_schedule(user_id: str, schedule_id: str, schedule_data: Dict[str, Any]):
    """
    Process a specific schedule for a user
    """
    logger.info(f"Processing schedule {schedule_id} for user {user_id}")
    # Add your schedule processing logic here
    return {
        "status": "completed",
        "user_id": user_id,
        "schedule_id": schedule_id,
        "executed_at": datetime.utcnow().isoformat()
    }

@celery_app.task(name='src.celery.tasks.manage_user_schedules')
def manage_user_schedules(user_id: str, schedules: Dict[str, Dict[str, Any]]):
    """
    Manage multiple schedules for a user
    """
    logger.info(f"Managing schedules for user {user_id}")
    results = []
    
    for schedule_id, schedule_data in schedules.items():
        # Process each schedule
        result = process_schedule.delay(user_id, schedule_id, schedule_data)
        results.append({
            "schedule_id": schedule_id,
            "task_id": result.id
        })
    
    return {
        "user_id": user_id,
        "schedules": results,
        "total_schedules": len(schedules)
    }

@celery_app.task(name='src.celery.tasks.hourly_task')
def hourly_task():
    """
    Example task that runs every hour
    """
    logger.info("Running hourly scheduled task")
    # Add your task logic here
    return {"status": "completed", "message": "Hourly task executed successfully"} 