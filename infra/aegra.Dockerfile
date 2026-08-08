# Aegra sidecar for the US-003 stage-1 validation target.
#
# Pinned to the exact revision every Aegra line reference in
# .oh/tasks/aegra-full-inversion/prd.md was verified against. Route
# registration order, the auth hook signature, and namespace scoping can all
# move between releases, so an unpinned image would silently invalidate the
# spec's findings.
FROM python:3.12-slim

ARG AEGRA_VERSION=0.9.25

WORKDIR /app

RUN pip install --no-cache-dir "aegra-api==${AEGRA_VERSION}"

# aegra.json and the graph module are bind-mounted by the compose file so the
# sidecar tracks the working tree without a rebuild.
EXPOSE 2026

CMD ["uvicorn", "aegra_api.main:app", "--host", "0.0.0.0", "--port", "2026"]
