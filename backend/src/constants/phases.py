from enum import Enum


class AgentPhase(str, Enum):
    """Unified phase names across cost tracking, observability, and harness features."""

    PLANNER = "planner"
    GENERATOR = "generator"
    EVALUATOR = "evaluator"
    HANDOFF = "handoff"
    NEGOTIATION = "negotiation"
    SOLO = "solo"
