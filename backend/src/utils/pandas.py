import fnmatch
import polars as pd


def drop_columns(df: pd.DataFrame, patterns: list[str]) -> pd.DataFrame:
    """
    Remove columns by exact name OR wildcard patterns.

    Args:
        df (pd.DataFrame): The DataFrame to clean.
        patterns (list[str]): Column names or wildcard patterns.
            Example: ["id", "timestamp", "canonicalUrl.*"]

    Returns:
        pd.DataFrame: DataFrame without matching columns.
    """
    if not isinstance(patterns, (list, set, tuple)):
        patterns = [patterns]

    # Compute full set of columns that match any pattern
    cols_to_drop = set()

    for pat in patterns:
        # Wildcard match using fnmatch
        if "*" in pat or "?" in pat:
            matched_cols = fnmatch.filter(df.columns, pat)
            cols_to_drop.update(matched_cols)
        else:
            # Exact match
            if pat in df.columns:
                cols_to_drop.add(pat)

    # Drop all matching columns
    return df.drop(columns=list(cols_to_drop), errors="ignore")