# US-003 deployment cleanup manifest

Captured immediately before removing the stage-0/1 sidecar deployment paths. Hashes are SHA-256 of the files in the dirty worktree; no reset or cleanup was used.

| Path | SHA-256 before cleanup | Final disposition |
|---|---|---|
| `.oh/tasks/aegra-full-inversion/runbook-us003.md` | `8b59f101c6fe92de3643a4ce49db1bf16edbc43e4df26871b3ce92c0f8a64a5a` | Replaced with the single-runtime migration/preflight runbook; operator-only restore steps retained and clearly marked unexecuted. |
| `Makefile` | `4e05596c89c8e431e9478307c3aee7e7b7cdebb0f243540e3169a1e1e32124dad3` | Sidecar targets removed; single API and migration-init targets retained. |
| `aegra.json` | `36c04e41e2f36861136235ce4f4987b9124b362d11e58bb02b1a4ef872b20661` | Removed root sidecar config; production config is `backend/aegra.json`, copied to `/app/aegra.json`. |
| `infra/aegra.Dockerfile` | `188a572d992aae7e16201977f171f685f3d34d1a4317ad9e7a1b2bf5dce73e81` | Removed; the backend API image is the Aegra image. |
| `infra/docker-compose.aegra.yml` | `f9789588e2e3ab2b498269eaab2bc8aee1084799b47c294394086b8d32c5ab01` | Removed; the main Compose API service owns port 8000. |
| `infra/aegra/hello_graph.py` | `c74c8cd1209586fbc2f12b2baae48d912cc5335d46c96d4af228926b3180e63c` | Removed temporary smoke graph; production factory is the only configured graph. |
| `infra/aegra/deepagent_graph.py` | `9326315e2183f7258d68fee03f0a1b96aabb61912a8ec125bc4a49124799ea29` | Removed temporary sidecar graph; production factory replaces it. |
| `infra/aegra/pyproject.toml` | `7249b63ab13f68481fd07ee28307bc106e19a63c0bad8dae60a1c8953b43f763` | Removed; `backend/pyproject.toml` and `backend/uv.lock` are authoritative. |
| `infra/aegra/uv.lock` | `f3904fa03a400600b12285ba5fafdf621cc6fafbd36c1514d89d2786f21997f8` | Removed; the backend lockfile carries the pinned Aegra dependency. |

The earlier baseline at `.oh/tasks/aegra-full-inversion/baseline.md` remains the historical pre-cutover record. This file records the exact dirty-worktree inputs consumed by this cutover.
