from fastapi import FastAPI, Request

from src.constants import APP_VERSION
from src.routes.v0 import auth as auth_v0  # For backward compatibility
from src.routes.v0 import info, llm, thread, tool, retrieve, source, token, storage, settings

#################################################################
# Create a separate app for authentication endpoints
#################################################################
auth_app = FastAPI(
    title="Armada Authentication API",
    version=APP_VERSION,
    description="Authentication endpoints for the Armada API",
    docs_url="/api",  # This will be accessible at /api/auth/api
    redoc_url="/redoc"  # This will be accessible at /api/auth/redoc
)

# Add auth routes to auth_app
auth_app.include_router(auth_v0)

#################################################################
# Create the v0 app (without auth endpoints)
#################################################################
app_v0 = FastAPI(
    title="Armada API",
    version="v0",
    description="Legacy API for Armada (excluding auth endpoints)",
    docs_url="/api",  # This will be accessible at /api/v0/api
    redoc_url="/redoc"  # This will be accessible at /api/v0/redoc
)

# Add v0 routes (excluding auth)
app_v0.include_router(info)
app_v0.include_router(llm)
app_v0.include_router(thread)
app_v0.include_router(tool)
app_v0.include_router(retrieve)
app_v0.include_router(source)
app_v0.include_router(token)
app_v0.include_router(storage)
app_v0.include_router(settings)

#################################################################
# Create the v1 app - uncomment and modify as you develop v1 routes
#################################################################
app_v1 = FastAPI(
    title="Armada API",
    version="v1",
    description="Version 1 of the Armada API with new features (excluding auth endpoints)",
    docs_url="/api",  # This will be accessible at /api/v1/api
    redoc_url="/redoc"  # This will be accessible at /api/v1/redoc
)

# Add v1 routes as you develop them (excluding auth)
# app_v1.include_router(your_v1_route)