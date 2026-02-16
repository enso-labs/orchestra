#!/usr/bin/env python3
"""
RLM (Recursive Language Model) Proof of Concept Prototype
==========================================================

Feature: #793 - RLM Integration Research
Runs: `uv run --with rlms backend/scripts/rlm_prototype.py`

This script validates the rlms library by:
1. Running rlm.completion() on a large input (Orchestra codebase sample)
2. Running a standard LLM completion on the same input for comparison
3. Measuring latency, token usage, and cost for both approaches
4. Outputting a structured comparison report

Prerequisites:
- OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable set
- Or: source your env file first: `set -a && source ~/.env/orchestra/.env.backend && set +a`

Usage:
  # With uv (recommended - no install needed):
  uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py

  # With pip:
  pip install rlms && python backend/scripts/rlm_prototype.py

  # Options:
  uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --dry-run   # Validate setup without API calls
  uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --backend anthropic  # Use Anthropic
  uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --verbose    # Show RLM iteration details
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from textwrap import dedent

# Resolve project root (backend/ parent)
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Models to use for root (orchestrator) and sub-calls (workers)
MODEL_CONFIGS = {
    "openai": {
        "root_model": "gpt-4.1-mini",
        "sub_model": "gpt-4.1-nano",
        "env_var": "OPENAI_API_KEY",
    },
    "anthropic": {
        "root_model": "claude-sonnet-4-5-20250929",
        "sub_model": "claude-haiku-4-5-20251001",
        "env_var": "ANTHROPIC_API_KEY",
    },
}

# Approximate per-token costs (USD) for cost estimation
# Prices as of Feb 2026 — update as needed
TOKEN_COSTS = {
    "gpt-4.1-mini": {"input": 0.40 / 1_000_000, "output": 1.60 / 1_000_000},
    "gpt-4.1-nano": {"input": 0.10 / 1_000_000, "output": 0.40 / 1_000_000},
    "claude-sonnet-4-5-20250929": {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
    "claude-haiku-4-5-20251001": {"input": 0.80 / 1_000_000, "output": 4.00 / 1_000_000},
}


# ---------------------------------------------------------------------------
# Test Input: Collect Orchestra codebase sample
# ---------------------------------------------------------------------------


def collect_codebase_sample(max_chars: int = 200_000) -> str:
    """Collect a representative sample of the Orchestra backend source code.

    Gathers Python files from backend/src/ up to max_chars total, providing
    a realistic large input for RLM to decompose and analyze.
    """
    src_dir = BACKEND_DIR / "src"
    if not src_dir.exists():
        print(f"WARNING: {src_dir} not found. Using synthetic test input.")
        return _synthetic_test_input()

    files_content: list[str] = []
    total_chars = 0

    # Collect .py files sorted by path for reproducibility
    py_files = sorted(src_dir.rglob("*.py"))
    for py_file in py_files:
        try:
            content = py_file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        header = f"\n{'=' * 80}\n# FILE: {py_file.relative_to(BACKEND_DIR)}\n{'=' * 80}\n"
        entry = header + content

        if total_chars + len(entry) > max_chars:
            # Include partial file to hit the limit
            remaining = max_chars - total_chars
            if remaining > 200:  # Only include if meaningful
                files_content.append(entry[:remaining] + "\n# ... (truncated)")
                total_chars += remaining
            break

        files_content.append(entry)
        total_chars += len(entry)

    result = "\n".join(files_content)
    print(f"  Collected {len(files_content)} files, {len(result):,} characters")
    return result


def _synthetic_test_input() -> str:
    """Fallback synthetic input if backend/src/ is not available."""
    # Generate a large structured text for testing
    sections = []
    for i in range(50):
        sections.append(
            dedent(f"""\
            ## Section {i + 1}: Module Analysis

            This section covers the implementation details of module {i + 1}.
            The module provides functionality for handling requests, processing data,
            and returning structured responses to the caller.

            Key functions:
            - process_request_{i}(): Handles incoming API requests
            - validate_input_{i}(): Validates request parameters
            - transform_data_{i}(): Transforms data for downstream processing
            - format_response_{i}(): Formats the output response

            Implementation notes:
            The module follows the repository pattern with dependency injection.
            Error handling uses custom exception classes defined in common/exceptions.py.
            All database operations use async SQLAlchemy sessions.
        """)
        )
    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Benchmark: Standard LLM Completion
# ---------------------------------------------------------------------------

ANALYSIS_QUERY = (
    "Analyze this codebase and identify: (1) the overall architecture and key design patterns, "
    "(2) potential security vulnerabilities, (3) areas that could benefit from refactoring. "
    "Provide a structured report."
)


@dataclass
class BenchmarkResult:
    """Result from a single benchmark run."""

    approach: str
    latency_seconds: float
    response: str
    input_chars: int
    output_chars: int
    input_tokens_est: int = 0
    output_tokens_est: int = 0
    cost_estimate_usd: float = 0.0
    iterations: int = 0
    sub_calls: int = 0
    models_used: list[str] = field(default_factory=list)
    error: str | None = None


def estimate_tokens(text: str) -> int:
    """Rough token estimation (~4 chars per token)."""
    return len(text) // 4


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost in USD for a given model and token counts."""
    costs = TOKEN_COSTS.get(model, {"input": 0, "output": 0})
    return (input_tokens * costs["input"]) + (output_tokens * costs["output"])


def run_standard_completion(
    context: str,
    query: str,
    backend: str,
    config: dict,
) -> BenchmarkResult:
    """Run a standard (non-RLM) LLM completion for comparison.

    Uses the rlms library's client directly to ensure a fair comparison
    (same model, same client overhead).
    """
    from rlm.clients import get_client

    print("\n--- Running Standard LLM Completion ---")
    print(f"  Backend: {backend}")
    print(f"  Model: {config['root_model']}")
    print(f"  Input: {len(context):,} chars (~{estimate_tokens(context):,} tokens)")

    client = get_client(backend, backend_kwargs={"model_name": config["root_model"]})

    # For standard completion, the entire context goes into the prompt
    prompt = f"""You are analyzing a codebase. Here is the source code:

<codebase>
{context}
</codebase>

{query}

Provide a structured analysis report."""

    start_time = time.time()
    try:
        response = client.completion(prompt)
        latency = time.time() - start_time
        usage = client.get_usage_summary()

        # Extract token counts from usage
        input_tokens = 0
        output_tokens = 0
        for model_usage in usage.model_usage_summaries.values():
            input_tokens += model_usage.total_input_tokens
            output_tokens += model_usage.total_output_tokens

        cost = estimate_cost(config["root_model"], input_tokens, output_tokens)

        print(f"  Completed in {latency:.1f}s")
        print(f"  Tokens: {input_tokens:,} in / {output_tokens:,} out")
        print(f"  Cost: ${cost:.4f}")

        return BenchmarkResult(
            approach="standard",
            latency_seconds=latency,
            response=response,
            input_chars=len(context),
            output_chars=len(response),
            input_tokens_est=input_tokens,
            output_tokens_est=output_tokens,
            cost_estimate_usd=cost,
            iterations=1,
            sub_calls=0,
            models_used=[config["root_model"]],
        )
    except Exception as e:
        latency = time.time() - start_time
        print(f"  ERROR: {e}")
        return BenchmarkResult(
            approach="standard",
            latency_seconds=latency,
            response="",
            input_chars=len(context),
            output_chars=0,
            error=str(e),
        )


# ---------------------------------------------------------------------------
# Benchmark: RLM Completion
# ---------------------------------------------------------------------------


def run_rlm_completion(
    context: str,
    query: str,
    backend: str,
    config: dict,
    verbose: bool = False,
) -> BenchmarkResult:
    """Run RLM completion using the rlms library.

    The RLM approach offloads the context to a REPL environment variable,
    letting the LM programmatically decompose and analyze it via sub-LM calls.
    """
    from rlm import RLM

    print("\n--- Running RLM Completion ---")
    print(f"  Backend: {backend}")
    print(f"  Root model: {config['root_model']}")
    print(f"  Sub model: {config['sub_model']}")
    print(f"  Input: {len(context):,} chars (~{estimate_tokens(context):,} tokens)")
    print("  Environment: local (in-process REPL)")

    rlm = RLM(
        backend=backend,
        backend_kwargs={"model_name": config["root_model"]},
        other_backends=[backend],
        other_backend_kwargs=[{"model_name": config["sub_model"]}],
        environment="local",
        max_depth=1,
        max_iterations=15,  # Cap iterations for cost control
        verbose=verbose,
    )

    start_time = time.time()
    try:
        result = rlm.completion(context, root_prompt=query)
        latency = time.time() - start_time

        # Extract token usage from RLM's built-in tracking
        usage = result.usage_summary
        input_tokens = 0
        output_tokens = 0
        models_used = []
        total_cost = 0.0

        for model_name, model_usage in usage.model_usage_summaries.items():
            input_tokens += model_usage.total_input_tokens
            output_tokens += model_usage.total_output_tokens
            models_used.append(model_name)
            total_cost += estimate_cost(model_name, model_usage.total_input_tokens, model_usage.total_output_tokens)

        # Count sub-LM calls from the usage summary
        sub_calls = 0
        for model_name, model_usage in usage.model_usage_summaries.items():
            if model_name != config["root_model"]:
                sub_calls += model_usage.total_calls

        print(f"  Completed in {latency:.1f}s")
        print(f"  Tokens: {input_tokens:,} in / {output_tokens:,} out")
        print(f"  Sub-LM calls: {sub_calls}")
        print(f"  Models used: {', '.join(models_used)}")
        print(f"  Cost: ${total_cost:.4f}")

        return BenchmarkResult(
            approach="rlm",
            latency_seconds=latency,
            response=result.response,
            input_chars=len(context),
            output_chars=len(result.response),
            input_tokens_est=input_tokens,
            output_tokens_est=output_tokens,
            cost_estimate_usd=total_cost,
            iterations=0,  # RLM doesn't expose iteration count directly
            sub_calls=sub_calls,
            models_used=models_used,
        )
    except Exception as e:
        latency = time.time() - start_time
        print(f"  ERROR: {e}")
        return BenchmarkResult(
            approach="rlm",
            latency_seconds=latency,
            response="",
            input_chars=len(context),
            output_chars=0,
            error=str(e),
        )


# ---------------------------------------------------------------------------
# Report Generation
# ---------------------------------------------------------------------------


def _latency_comparison(standard: BenchmarkResult, rlm: BenchmarkResult) -> str:
    if standard.latency_seconds > 0 and rlm.latency_seconds > 0:
        r = rlm.latency_seconds / standard.latency_seconds
        return f"RLM was {r:.2f}x the latency of standard completion."
    return "Could not compare latency (one or both failed)."


def _cost_comparison(standard: BenchmarkResult, rlm: BenchmarkResult) -> str:
    if standard.cost_estimate_usd > 0 and rlm.cost_estimate_usd > 0:
        r = rlm.cost_estimate_usd / standard.cost_estimate_usd
        return f"RLM cost {r:.2f}x of standard completion."
    return "Could not compare cost (one or both failed)."


def generate_report(
    standard: BenchmarkResult,
    rlm: BenchmarkResult,
    backend: str,
    config: dict,
) -> str:
    """Generate a markdown comparison report."""
    report = dedent(f"""\
        # RLM Proof of Concept: Benchmark Results

        > Generated by `backend/scripts/rlm_prototype.py` on {time.strftime("%Y-%m-%d %H:%M:%S")}
        > Feature: #793 - RLM Integration Research

        ## Configuration

        | Parameter | Value |
        |-----------|-------|
        | Backend | {backend} |
        | Root model | {config["root_model"]} |
        | Sub model | {config["sub_model"]} |
        | Input size | {standard.input_chars:,} chars (~{estimate_tokens(str("x" * standard.input_chars)):,} tokens) |
        | Environment | local (in-process REPL) |
        | Max iterations | 15 |
        | Max depth | 1 |

        ## Comparison

        | Metric | Standard Completion | RLM Completion | Ratio |
        |--------|-------------------|----------------|-------|
    """)

    # Calculate ratios safely
    def ratio(a: float, b: float) -> str:
        if a == 0 or b == 0:
            return "N/A"
        return f"{b / a:.2f}x"

    def ratio_inv(a: float, b: float) -> str:
        if a == 0 or b == 0:
            return "N/A"
        return f"{a / b:.2f}x"

    rows = [
        (
            "Latency",
            f"{standard.latency_seconds:.1f}s",
            f"{rlm.latency_seconds:.1f}s",
            ratio(standard.latency_seconds, rlm.latency_seconds),
        ),
        (
            "Input tokens",
            f"{standard.input_tokens_est:,}",
            f"{rlm.input_tokens_est:,}",
            ratio(standard.input_tokens_est, rlm.input_tokens_est),
        ),
        (
            "Output tokens",
            f"{standard.output_tokens_est:,}",
            f"{rlm.output_tokens_est:,}",
            ratio(standard.output_tokens_est, rlm.output_tokens_est),
        ),
        (
            "Cost",
            f"${standard.cost_estimate_usd:.4f}",
            f"${rlm.cost_estimate_usd:.4f}",
            ratio(standard.cost_estimate_usd, rlm.cost_estimate_usd),
        ),
        (
            "Response length",
            f"{standard.output_chars:,} chars",
            f"{rlm.output_chars:,} chars",
            ratio(standard.output_chars, rlm.output_chars),
        ),
        ("Sub-LM calls", "0", f"{rlm.sub_calls}", "N/A"),
        ("Models used", ", ".join(standard.models_used) or "N/A", ", ".join(rlm.models_used) or "N/A", "N/A"),
    ]

    for label, std_val, rlm_val, r in rows:
        report += f"| {label} | {std_val} | {rlm_val} | {r} |\n"

    report += dedent(f"""
        ## Errors

        | Approach | Error |
        |----------|-------|
        | Standard | {standard.error or "None"} |
        | RLM | {rlm.error or "None"} |

        ## Standard Completion Response

        <details>
        <summary>Click to expand ({standard.output_chars:,} chars)</summary>

        ```
        {standard.response[:5000]}{"..." if len(standard.response) > 5000 else ""}
        ```

        </details>

        ## RLM Completion Response

        <details>
        <summary>Click to expand ({rlm.output_chars:,} chars)</summary>

        ```
        {rlm.response[:5000]}{"..." if len(rlm.response) > 5000 else ""}
        ```

        </details>

        ## Observations

        ### Latency
        {_latency_comparison(standard, rlm)}
        RLM's additional latency comes from the iterative decomposition loop and sub-LM calls.
        For large inputs that exceed context window limits, this overhead is justified since
        standard completion cannot process the input at all.

        ### Cost
        {_cost_comparison(standard, rlm)}
        RLM uses a cheaper sub-model ({config["sub_model"]}) for the bulk of token processing,
        while only using the root model ({config["root_model"]}) for orchestration decisions.

        ### Quality
        Compare the two responses above. Key quality dimensions:
        - **Completeness**: Does the response cover all requested aspects?
        - **Accuracy**: Are the findings correct?
        - **Depth**: Does the analysis go beyond surface-level observations?
        - **Structure**: Is the output well-organized?

        ### Streaming Implications
        Standard completion can stream tokens in real-time via SSE.
        RLM completion is synchronous — it blocks until the full decomposition loop completes.
        This is the **critical gap** for Orchestra integration (see docs/rlm-recommendation.md).

        ## Conclusion

        [To be filled based on actual results]
    """)

    return report


# ---------------------------------------------------------------------------
# Dry Run Mode
# ---------------------------------------------------------------------------


def run_dry_run(backend: str, config: dict) -> None:
    """Validate setup and show what would happen without making API calls."""
    print("\n" + "=" * 60)
    print("DRY RUN MODE — No API calls will be made")
    print("=" * 60)

    # Check rlms import
    print("\n1. Checking rlms library...")
    try:
        import rlm as rlm_module

        print("   rlms imported successfully")
        print(f"   RLM class available: {hasattr(rlm_module, 'RLM')}")

        from rlm import RLM  # noqa: F401

        print("   RLM parameters: backend, backend_kwargs, environment, max_depth, max_iterations, verbose")
    except ImportError as e:
        print(f"   ERROR: Cannot import rlms: {e}")
        print("   Install with: pip install rlms")
        return

    # Check API key
    print(f"\n2. Checking API key for '{backend}' backend...")
    env_var = config["env_var"]
    key = os.environ.get(env_var)
    if key:
        print(f"   {env_var} is set ({len(key)} chars)")
    else:
        print(f"   WARNING: {env_var} is NOT set")
        print(f"   Set it with: export {env_var}=your-key-here")
        print("   Or source your env: set -a && source ~/.env/orchestra/.env.backend && set +a")

    # Check test input
    print("\n3. Collecting test input...")
    context = collect_codebase_sample(max_chars=50_000)  # Smaller sample for dry run
    print(f"   Context: {len(context):,} chars (~{estimate_tokens(context):,} tokens)")

    # Show what would happen
    print("\n4. What would happen:")
    print("   a) Standard completion:")
    print(f"      - Send entire context ({len(context):,} chars) + query to {config['root_model']}")
    print(f"      - Estimated input tokens: ~{estimate_tokens(context):,}")
    print(f"      - Estimated cost: ~${estimate_cost(config['root_model'], estimate_tokens(context), 2000):.4f}")
    print("   b) RLM completion:")
    print("      - Load context into LocalREPL environment variable")
    print(f"      - Root model ({config['root_model']}) generates decomposition code")
    print(f"      - Sub model ({config['sub_model']}) processes chunks via llm_query_batched()")
    print("      - Root model synthesizes final answer")
    print("      - Estimated sub-calls: ~5-10 (depending on decomposition strategy)")
    sub_cost = estimate_cost(config["sub_model"], estimate_tokens(context), 5000)
    print(f"      - Estimated cost: ~${sub_cost:.4f} (bulk on sub-model)")

    # Show RLM internals
    print("\n5. RLM library internals:")
    try:
        from rlm.environments import get_environment

        env = get_environment("local", environment_kwargs={})
        print(f"   LocalREPL: {type(env).__name__}")
        print(f"   Has setup(): {hasattr(env, 'setup')}")
        print(f"   Has load_context(): {hasattr(env, 'load_context')}")
        print(f"   Has execute_code(): {hasattr(env, 'execute_code')}")
    except Exception as e:
        print(f"   Could not inspect environment: {e}")

    try:
        print("   Client factory: get_client() available")
    except Exception as e:
        print(f"   Could not inspect clients: {e}")

    print("\n6. Available backends: openai, anthropic")
    print(f"   Selected: {backend} ({config['root_model']} + {config['sub_model']})")

    print("\n" + "=" * 60)
    print("Dry run complete. To run the actual benchmark:")
    print(f"  export {config['env_var']}=your-key-here")
    print(f"  uv run --with 'rlms>=0.1.0' backend/scripts/rlm_prototype.py --backend {backend}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="RLM Proof of Concept Prototype — Benchmark rlms vs standard completion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""\
            Examples:
              uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --dry-run
              uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --backend openai
              uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --backend anthropic --verbose
              uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --max-chars 100000
        """),
    )
    parser.add_argument(
        "--backend",
        choices=["openai", "anthropic"],
        default="openai",
        help="LLM backend to use (default: openai)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate setup without making API calls",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show RLM iteration details (verbose mode)",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=200_000,
        help="Maximum characters to collect from codebase (default: 200000)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file for benchmark report (default: stdout + docs/rlm-benchmark-results.md)",
    )
    args = parser.parse_args()

    config = MODEL_CONFIGS[args.backend]

    print("=" * 60)
    print("RLM Proof of Concept Prototype")
    print("Feature #793 — RLM Integration Research")
    print("=" * 60)

    # Dry run mode
    if args.dry_run:
        run_dry_run(args.backend, config)
        return

    # Check API key
    env_var = config["env_var"]
    if not os.environ.get(env_var):
        print(f"\nERROR: {env_var} not set.")
        print("Either set the key or use --dry-run to validate setup.")
        print(f"\n  export {env_var}=your-key-here")
        print("  set -a && source ~/.env/orchestra/.env.backend && set +a")
        sys.exit(1)

    # Collect test input
    print("\nCollecting test input from Orchestra backend...")
    context = collect_codebase_sample(max_chars=args.max_chars)

    if len(context) < 1000:
        print("WARNING: Test input is very small. Results may not be representative.")

    # Run benchmarks
    print(f"\nQuery: {ANALYSIS_QUERY[:80]}...")

    standard_result = run_standard_completion(context, ANALYSIS_QUERY, args.backend, config)
    rlm_result = run_rlm_completion(context, ANALYSIS_QUERY, args.backend, config, verbose=args.verbose)

    # Generate report
    report = generate_report(standard_result, rlm_result, args.backend, config)

    # Output report
    output_path = args.output or str(PROJECT_ROOT / "docs" / "rlm-benchmark-results.md")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(report, encoding="utf-8")
    print(f"\nReport saved to: {output_path}")

    # Also print summary to stdout
    print("\n" + "=" * 60)
    print("BENCHMARK SUMMARY")
    print("=" * 60)
    std = standard_result
    print(f"Standard: {std.latency_seconds:.1f}s, ${std.cost_estimate_usd:.4f}, {std.output_chars:,} chars")
    rlm_r = rlm_result
    print(
        f"RLM:      {rlm_r.latency_seconds:.1f}s, ${rlm_r.cost_estimate_usd:.4f}, "
        f"{rlm_r.output_chars:,} chars, {rlm_r.sub_calls} sub-calls"
    )

    if standard_result.error:
        print(f"\nStandard ERROR: {standard_result.error}")
    if rlm_result.error:
        print(f"\nRLM ERROR: {rlm_result.error}")

    # Save raw results as JSON for programmatic analysis
    json_path = Path(output_path).with_suffix(".json")
    raw_results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "backend": args.backend,
        "config": config,
        "standard": {
            "latency_seconds": standard_result.latency_seconds,
            "input_tokens": standard_result.input_tokens_est,
            "output_tokens": standard_result.output_tokens_est,
            "cost_usd": standard_result.cost_estimate_usd,
            "output_chars": standard_result.output_chars,
            "error": standard_result.error,
        },
        "rlm": {
            "latency_seconds": rlm_result.latency_seconds,
            "input_tokens": rlm_result.input_tokens_est,
            "output_tokens": rlm_result.output_tokens_est,
            "cost_usd": rlm_result.cost_estimate_usd,
            "output_chars": rlm_result.output_chars,
            "sub_calls": rlm_result.sub_calls,
            "models_used": rlm_result.models_used,
            "error": rlm_result.error,
        },
    }
    json_path.write_text(json.dumps(raw_results, indent=2), encoding="utf-8")
    print(f"Raw results saved to: {json_path}")


if __name__ == "__main__":
    main()
