from .config import celery_app
from .tasks import hourly_task

__all__ = ['celery_app', 'hourly_task'] 