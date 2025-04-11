from celery import Celery
from celery.schedules import crontab
from src.celery.tasks import manage_user_schedules

# Initialize Celery app
celery_app = Celery(
    'app',
    broker='redis://redis:6379/0',
    backend='redis://redis:6379/0',
    include=['src.celery.tasks']
)

# Celery Configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour timeout
    worker_prefetch_multiplier=1,  # Process one task at a time
    task_acks_late=True,  # Acknowledge tasks after they're completed
    task_reject_on_worker_lost=True,  # Requeue tasks if worker dies
)

# Configure Celery Beat schedule
celery_app.conf.beat_schedule = {
    # The schedule will be dynamically updated based on user schedules
    # This is just a placeholder for any system-wide tasks
    'system-health-check': {
        'task': 'src.celery.tasks.hourly_task',
        'schedule': crontab(minute=0, hour='*'),
    },
}

# Function to dynamically add/update user schedules
def update_user_schedules(user_id: str, schedules: dict):
    """
    Update the Celery Beat schedule for a specific user
    """
    for schedule_id, schedule_data in schedules.items():
        task_name = f'user-{user_id}-schedule-{schedule_id}'
        celery_app.conf.beat_schedule[task_name] = {
            'task': 'src.celery.tasks.process_schedule',
            'schedule': schedule_data.get('schedule', crontab()),  # Default to hourly if not specified
            'kwargs': {
                'user_id': user_id,
                'schedule_id': schedule_id,
                'schedule_data': schedule_data
            }
        }
    celery_app.conf.update()

user_schedules = {
    "schedule1": {
        "schedule": crontab(minute=0, hour='*/2'),  # Every 2 hours
        "data": {"some": "configuration"}
    },
    "schedule2": {
        "schedule": crontab(minute=0, hour='*/4'),  # Every 4 hours
        "data": {"other": "configuration"}
    }
}

# Update schedules for a user
update_user_schedules("user123", user_schedules)

# Process all schedules for a user
result = manage_user_schedules.delay("user123", user_schedules) 