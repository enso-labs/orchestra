# Stage 0/1 Baseline Disposition

Captured before full-cutover implementation on branch `task/976-aegra-full-inversion` (PR #977). This manifest protects the existing dirty migration-table/sidecar work; no reset or cleanup is authorized by this artifact.

## SHA-256 manifest

| Path | SHA-256 before cutover | Final disposition |
|---|---|---|
| `.oh/tasks/aegra-full-inversion/runbook-us003.md` | `8b59f101c6fe92de3643a4ce49db1bf16edbc43e4df26871b3ce92c0f8a64a5a` | Replace with the final single-runtime/migration runbook while retaining the validated migration-table ownership and operator-only restore steps. |
| `Makefile` | `4e05596c89c8e431e9478307c3aee7b7cdebb0f243540e3169a1e1e32124dad3` | Remove sidecar/dev-Aegra targets and retain/update the single backend runtime targets. |
| `aegra.json` | `36c04e41e2f36861136235ce4f4987b9124b362d11e58bb02b1a4ef872b20661` | Move production configuration into `backend/aegra.json` with image-relative paths, then delete this root sidecar config. |
| `infra/aegra.Dockerfile` | `188a572d992aae7e16201977f171f685f3d34d1a4317ad9e7a1b2bf5dce73e81` | Delete after the backend image becomes the Aegra runtime. |
| `infra/docker-compose.aegra.yml` | `f9789588e2e3ab2b498269eaab2bc8aee1084799b47c294394086b8d32c5ab01` | Delete after the main Compose API service owns `:8000`. |
| `infra/aegra/deepagent_graph.py` | `9326315e2183f7258d68fee03f0a1b96aabb61912a8ec125bc4a49124799ea29` | Delete temporary sidecar graph; production factory replaces it. |
| `infra/aegra/pyproject.toml` | `7249b63ab13f68481fd07ee28307bc106e19a63c0bad8dae60a1c8953b43f763` | Delete standalone sidecar dependency project; backend dependency files become authoritative. |
| `infra/aegra/uv.lock` | `f3904fa03a400600b12285ba5fafdf621cc6fafbd36c1514d89d2786f21997f8` | Delete generated sidecar lockfile; backend lockfile becomes authoritative. |

## Scope decision

The captain clarified that PR #977 must become the atomic Aegra full cutover. The existing branch and PR are retained; the PR description was updated to state that the original stage-only scope is superseded. The baseline files are inputs to the cutover, not disposable unrelated changes.
