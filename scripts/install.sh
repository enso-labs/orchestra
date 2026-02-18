#!/usr/bin/env bash
# Orchestra Local Install Script
# Installs Orchestra on Ubuntu/WSL with all dependencies.
# Usage: curl -sSL https://raw.githubusercontent.com/ruska-ai/orchestra/master/scripts/install.sh | bash
#
# The script is idempotent - safe to run multiple times.

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================
ORCHESTRA_REPO="https://github.com/ruska-ai/orchestra.git"
ORCHESTRA_BRANCH="master"
INSTALL_DIR="$HOME/.ruska/orchestra"
WORKSPACE_DIR="$HOME/.ruska/workspace"
CONFIG_DIR="$HOME/.ruska/config"
DATA_DIR="$HOME/.ruska/data"
ENV_DIR="$HOME/.env/orchestra"
ENV_FILE="$ENV_DIR/.env.backend.local"
PYTHON_MIN_VERSION="3.12"
NODE_MIN_VERSION="22"
PG_VERSION="16"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================================================================
# Helper functions
# ==============================================================================
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

command_exists() { command -v "$1" &>/dev/null; }

version_gte() {
    # Returns 0 if $1 >= $2 (major.minor comparison)
    local v1_major v1_minor v2_major v2_minor
    v1_major=$(echo "$1" | cut -d. -f1)
    v1_minor=$(echo "$1" | cut -d. -f2)
    v2_major=$(echo "$2" | cut -d. -f1)
    v2_minor=$(echo "$2" | cut -d. -f2)
    if [ "$v1_major" -gt "$v2_major" ]; then return 0; fi
    if [ "$v1_major" -eq "$v2_major" ] && [ "${v1_minor:-0}" -ge "${v2_minor:-0}" ]; then return 0; fi
    return 1
}

# ==============================================================================
# OS Detection
# ==============================================================================
detect_os() {
    if [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        OS_ID="$ID"
        OS_VERSION="$VERSION_ID"
    else
        log_error "Cannot detect OS. This script supports Ubuntu/Debian and WSL."
        exit 1
    fi

    IS_WSL=false
    if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
        IS_WSL=true
    fi

    log_info "Detected OS: $OS_ID $OS_VERSION (WSL: $IS_WSL)"

    case "$OS_ID" in
        ubuntu|debian)
            ;;
        *)
            log_warn "Untested OS: $OS_ID. This script is designed for Ubuntu/Debian."
            log_warn "Proceeding anyway - some package commands may fail."
            ;;
    esac
}

# ==============================================================================
# System Dependencies
# ==============================================================================
install_system_deps() {
    log_info "Installing system dependencies..."

    sudo apt-get update -qq

    # Core build tools
    sudo apt-get install -y -qq \
        build-essential \
        curl \
        wget \
        git \
        software-properties-common \
        ca-certificates \
        gnupg \
        lsb-release \
        libpq-dev \
        > /dev/null 2>&1

    log_success "System dependencies installed."
}

# ==============================================================================
# Python 3.12+
# ==============================================================================
install_python() {
    local current_version

    if command_exists python3; then
        current_version=$(python3 --version | grep -oP '\d+\.\d+')
        if version_gte "$current_version" "$PYTHON_MIN_VERSION"; then
            log_success "Python $current_version already installed (>= $PYTHON_MIN_VERSION)."
            return
        fi
    fi

    log_info "Installing Python $PYTHON_MIN_VERSION+..."
    sudo add-apt-repository -y ppa:deadsnakes/ppa > /dev/null 2>&1
    sudo apt-get update -qq
    sudo apt-get install -y -qq \
        python3.12 \
        python3.12-venv \
        python3.12-dev \
        > /dev/null 2>&1

    # Set python3.12 as default python3 if current version is too old
    if ! version_gte "$(python3 --version | grep -oP '\d+\.\d+')" "$PYTHON_MIN_VERSION"; then
        sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
    fi

    log_success "Python $(python3 --version | grep -oP '\d+\.\d+\.\d+') installed."
}

# ==============================================================================
# uv (Python package manager)
# ==============================================================================
install_uv() {
    if command_exists uv; then
        log_success "uv already installed ($(uv --version))."
        return
    fi

    log_info "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1

    # Add to PATH for current session
    export PATH="$HOME/.local/bin:$PATH"

    if command_exists uv; then
        log_success "uv installed ($(uv --version))."
    else
        log_error "uv installation failed. Please install manually: https://docs.astral.sh/uv/"
        exit 1
    fi
}

# ==============================================================================
# Node.js 22+
# ==============================================================================
install_node() {
    local current_version

    if command_exists node; then
        current_version=$(node --version | grep -oP '\d+' | head -1)
        if [ "$current_version" -ge "$NODE_MIN_VERSION" ]; then
            log_success "Node.js v$(node --version | grep -oP '\d+\.\d+\.\d+') already installed (>= $NODE_MIN_VERSION)."
            return
        fi
    fi

    log_info "Installing Node.js $NODE_MIN_VERSION+..."

    # Use NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y -qq nodejs > /dev/null 2>&1

    log_success "Node.js $(node --version) installed."
}

# ==============================================================================
# PostgreSQL
# ==============================================================================
install_postgres() {
    if command_exists psql; then
        local pg_ver
        pg_ver=$(psql --version | grep -oP '\d+' | head -1)
        log_success "PostgreSQL $pg_ver already installed."
    else
        log_info "Installing PostgreSQL $PG_VERSION..."

        # Add PostgreSQL official repo
        sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg 2>/dev/null
        sudo apt-get update -qq
        sudo apt-get install -y -qq "postgresql-$PG_VERSION" "postgresql-$PG_VERSION-pgvector" > /dev/null 2>&1

        log_success "PostgreSQL $PG_VERSION installed."
    fi

    # Ensure PostgreSQL is running
    if command_exists systemctl && systemctl is-active --quiet postgresql 2>/dev/null; then
        log_success "PostgreSQL is running."
    else
        log_info "Starting PostgreSQL..."
        # WSL or systems without systemd
        if [ "$IS_WSL" = true ] || ! command_exists systemctl; then
            sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
        else
            sudo systemctl enable postgresql
            sudo systemctl start postgresql
        fi
        log_success "PostgreSQL started."
    fi
}

# ==============================================================================
# Redis (optional - only for distributed workers)
# ==============================================================================
install_redis() {
    if command_exists redis-server; then
        log_success "Redis already installed."
        return
    fi

    log_info "Installing Redis..."
    sudo apt-get install -y -qq redis-server > /dev/null 2>&1

    # Start Redis
    if [ "$IS_WSL" = true ] || ! command_exists systemctl; then
        sudo service redis-server start 2>/dev/null || true
    else
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
    fi

    log_success "Redis installed and started."
}

# ==============================================================================
# Directory Structure
# ==============================================================================
create_directories() {
    log_info "Creating directory structure..."

    mkdir -p "$WORKSPACE_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$ENV_DIR"

    log_success "Directory structure created:"
    log_info "  Workspace: $WORKSPACE_DIR"
    log_info "  Config:    $CONFIG_DIR"
    log_info "  Data:      $DATA_DIR"
    log_info "  Env:       $ENV_DIR"
}

# ==============================================================================
# Clone Repository
# ==============================================================================
clone_repo() {
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Repository exists, pulling latest changes..."
        git -C "$INSTALL_DIR" fetch origin
        git -C "$INSTALL_DIR" pull origin "$ORCHESTRA_BRANCH" --ff-only 2>/dev/null || \
            log_warn "Could not fast-forward, keeping current version."
    else
        log_info "Cloning Orchestra repository..."
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone --branch "$ORCHESTRA_BRANCH" "$ORCHESTRA_REPO" "$INSTALL_DIR"
    fi

    log_success "Repository ready at $INSTALL_DIR"
}

# ==============================================================================
# Backend Setup
# ==============================================================================
setup_backend() {
    log_info "Setting up backend..."

    cd "$INSTALL_DIR/backend"

    # Create venv and install dependencies (without optional distributed deps)
    uv venv --python python3.12 2>/dev/null || uv venv
    uv sync

    log_success "Backend dependencies installed."
}

# ==============================================================================
# Frontend Setup
# ==============================================================================
setup_frontend() {
    log_info "Setting up frontend..."

    cd "$INSTALL_DIR/frontend"

    npm install --silent 2>/dev/null
    npm run build

    log_success "Frontend built and deployed to backend/src/public/"
}

# ==============================================================================
# Environment Configuration
# ==============================================================================
setup_env() {
    if [ -f "$ENV_FILE" ]; then
        log_success "Environment file already exists at $ENV_FILE"
        log_warn "Not overwriting. Edit manually if needed."
        return
    fi

    log_info "Generating environment file..."

    # Generate random secrets
    local jwt_secret app_secret
    jwt_secret=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    app_secret=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

    cp "$INSTALL_DIR/backend/.env.local.example" "$ENV_FILE"

    # Replace placeholder secrets with generated ones
    sed -i "s|JWT_SECRET_KEY=change-me-in-production|JWT_SECRET_KEY=$jwt_secret|" "$ENV_FILE"
    sed -i "s|APP_SECRET_KEY=change-me-in-production|APP_SECRET_KEY=$app_secret|" "$ENV_FILE"

    log_success "Environment file created at $ENV_FILE"
    log_warn "Edit $ENV_FILE to add your LLM API keys (at least one required)."
}

# ==============================================================================
# Database Setup
# ==============================================================================
setup_database() {
    log_info "Setting up database..."

    local db_name="orchestra"
    local db_user="postgres"

    # Check if database exists
    if sudo -u postgres psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$db_name"; then
        log_success "Database '$db_name' already exists."
    else
        log_info "Creating database '$db_name'..."
        sudo -u postgres createdb "$db_name" 2>/dev/null || \
            sudo -u postgres psql -c "CREATE DATABASE $db_name;" 2>/dev/null || true
        log_success "Database '$db_name' created."
    fi

    # Enable pgvector extension
    sudo -u postgres psql -d "$db_name" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

    # Run migrations
    cd "$INSTALL_DIR/backend"
    log_info "Running database migrations..."
    set -a
    # shellcheck source=/dev/null
    . "$ENV_FILE"
    set +a
    uv run alembic upgrade head 2>/dev/null || log_warn "Migrations may need manual review."

    # Seed default users
    log_info "Seeding default users..."
    uv run python -m seeds.user_seeder --env-file "$ENV_FILE" 2>/dev/null || \
        log_warn "User seeding failed - may need database connection configured."

    log_success "Database setup complete."
}

# ==============================================================================
# Verification
# ==============================================================================
verify_installation() {
    log_info "Verifying installation..."

    local all_ok=true

    # Check Python
    if command_exists python3 && version_gte "$(python3 --version | grep -oP '\d+\.\d+')" "$PYTHON_MIN_VERSION"; then
        log_success "Python $(python3 --version | grep -oP '\d+\.\d+\.\d+')"
    else
        log_error "Python $PYTHON_MIN_VERSION+ not found"
        all_ok=false
    fi

    # Check uv
    if command_exists uv; then
        log_success "uv $(uv --version | grep -oP '\d+\.\d+\.\d+')"
    else
        log_error "uv not found"
        all_ok=false
    fi

    # Check Node
    if command_exists node; then
        log_success "Node.js $(node --version)"
    else
        log_error "Node.js not found"
        all_ok=false
    fi

    # Check PostgreSQL
    if command_exists psql; then
        log_success "PostgreSQL $(psql --version | grep -oP '\d+\.\d+')"
    else
        log_error "PostgreSQL not found"
        all_ok=false
    fi

    # Check Redis
    if command_exists redis-server; then
        log_success "Redis $(redis-server --version | grep -oP 'v=\K\d+\.\d+\.\d+')"
    else
        log_warn "Redis not installed (optional - only needed for distributed workers)"
    fi

    # Check install directory
    if [ -d "$INSTALL_DIR/backend" ] && [ -d "$INSTALL_DIR/frontend" ]; then
        log_success "Orchestra installed at $INSTALL_DIR"
    else
        log_error "Orchestra not found at $INSTALL_DIR"
        all_ok=false
    fi

    # Check env file
    if [ -f "$ENV_FILE" ]; then
        log_success "Environment file at $ENV_FILE"
    else
        log_error "Environment file missing at $ENV_FILE"
        all_ok=false
    fi

    # Check frontend build output
    if [ -d "$INSTALL_DIR/backend/src/public" ]; then
        log_success "Frontend build output present"
    else
        log_warn "Frontend build output not found"
    fi

    echo ""
    if [ "$all_ok" = true ]; then
        log_success "Installation verified successfully!"
    else
        log_error "Some checks failed. Review the output above."
    fi
}

# ==============================================================================
# Main
# ==============================================================================
main() {
    echo ""
    echo "============================================"
    echo "  Orchestra Local Installation"
    echo "============================================"
    echo ""

    detect_os
    install_system_deps
    install_python
    install_uv
    install_node
    install_postgres
    install_redis
    create_directories
    clone_repo
    setup_backend
    setup_frontend
    setup_env
    setup_database
    verify_installation

    echo ""
    echo "============================================"
    echo "  Installation Complete!"
    echo "============================================"
    echo ""
    log_info "To start Orchestra:"
    echo "  cd $INSTALL_DIR && make local"
    echo ""
    log_info "Or run the backend directly:"
    echo "  cd $INSTALL_DIR/backend"
    echo "  uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --env-file $ENV_FILE"
    echo ""
    log_info "Default login credentials:"
    echo "  Admin: admin@example.com / test1234"
    echo "  User:  user@example.com  / test1234"
    echo ""
    log_warn "Don't forget to add your LLM API keys to $ENV_FILE"
    echo ""
}

main "$@"
