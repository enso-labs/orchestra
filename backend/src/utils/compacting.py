# Compacting Middleware for Orchestra
#
# US-001 Finding: deepagents==0.3.8 does NOT ship internal SummarizationMiddleware.
# Verified by inspecting deepagents source - no summarization/compaction/middleware
# references found in the package. create_deep_agent() has no compaction parameters.
#
# Decision: Proceed with Phase 2B (full Orchestra implementation).
