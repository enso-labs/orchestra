"""Static contracts for the single Aegra image and migration init."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.migrate import MigrationConfig, MigrationPreflightError, validate_configured_identity

BACKEND = Path(__file__).parents[2]
REPO = BACKEND.parent


def test_production_aegra_config_uses_image_relative_paths() -> None:
    config = json.loads((BACKEND / "aegra.json").read_text())
    assert config["graphs"] == {"orchestra": "./src/agents/factory.py:build_graph"}
    assert config["auth"]["path"] == "./aegra_auth.py:auth"
    assert config["http"]["app"] == "./custom_app.py:app"
    assert "hello" not in config["graphs"]
    assert "deepagent" not in config["graphs"]


def test_database_urls_must_identify_one_target() -> None:
    config = MigrationConfig(
        orchestra_url="postgresql://user:one@db.example:5432/orchestra",
        aegra_url="postgresql://user:two@db.example:5432/orchestra",
        expected_database="orchestra",
    )
    assert validate_configured_identity(config).database == "orchestra"

    with pytest.raises(MigrationPreflightError, match="different database identities"):
        validate_configured_identity(
            MigrationConfig(
                orchestra_url="postgresql://user@db.example:5432/orchestra",
                aegra_url="postgresql://user@db.example:5432/other",
                expected_database=None,
            )
        )


def test_migration_path_does_not_create_or_select_a_default_database() -> None:
    migration_env = (BACKEND / "migrations/env.py").read_text()
    alembic_ini = (BACKEND / "alembic.ini").read_text()
    assert "CREATE DATABASE" not in migration_env
    assert "lg_template_dev" not in alembic_ini
    assert "DB_URI" in migration_env


def test_deployment_has_one_api_runtime() -> None:
    compose = (REPO / "infra/docker-compose.yml").read_text()
    dockerfile = (REPO / "infra/backend.Dockerfile").read_text()
    assert "    app:" in compose
    assert "    migrate:" in compose
    assert "    worker:" not in compose
    assert ":" + "2026" not in compose
    assert "aegra_api.main:app" in compose
    assert "service_completed_successfully" in compose
    assert "aegra_api.main:app" in dockerfile
    assert "worker" not in dockerfile.lower()
    assert "aegra.json" in dockerfile


def test_custom_static_surface_is_explicit_not_a_protocol_catch_all() -> None:
    custom_app = (BACKEND / "custom_app.py").read_text()
    assert '"/chat/{path:path}"' in custom_app
    assert '"/{filename:path}"' not in custom_app
    assert "static_app.routes" in custom_app
