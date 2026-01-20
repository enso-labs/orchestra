"""
Unit tests for web_search tool with Tavily fallback.

Tests the following scenarios:
- SearXNG success (no fallback triggered)
- SearXNG empty results triggers Tavily fallback
- SearXNG exception triggers Tavily fallback
- Tavily result normalization
- No providers configured raises ToolException
- All providers fail returns empty list
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from langchain_core.tools import ToolException

from src.tools.search import (
    _search_with_searx,
    _search_with_tavily,
    _normalize_tavily_results,
    web_search,
)


class TestSearchWithSearx:
    """Tests for _search_with_searx helper function."""

    @pytest.mark.asyncio
    @patch("src.tools.search.SearxSearchWrapper")
    async def test_searx_success_returns_results(self, mock_searx_class):
        """SearXNG returns results successfully."""
        mock_searx = MagicMock()
        mock_searx.aresults = AsyncMock(
            return_value=[{"title": "Test", "link": "http://example.com"}]
        )
        mock_searx_class.return_value = mock_searx

        results, error = await _search_with_searx(
            query="test query",
            num_results=5,
            searx_url="http://searx:8080",
            engines=["google"],
            categories=["general"],
        )

        assert len(results) == 1
        assert results[0]["title"] == "Test"
        assert error is None

    @pytest.mark.asyncio
    @patch("src.tools.search.SearxSearchWrapper")
    async def test_searx_empty_results(self, mock_searx_class):
        """SearXNG returns empty results."""
        mock_searx = MagicMock()
        mock_searx.aresults = AsyncMock(return_value=[])
        mock_searx_class.return_value = mock_searx

        results, error = await _search_with_searx(
            query="test query",
            num_results=5,
            searx_url="http://searx:8080",
            engines=["google"],
            categories=["general"],
        )

        assert results == []
        assert error is None

    @pytest.mark.asyncio
    @patch("src.tools.search.SearxSearchWrapper")
    async def test_searx_exception_returns_error(self, mock_searx_class):
        """SearXNG throws exception, error is captured."""
        mock_searx = MagicMock()
        mock_searx.aresults = AsyncMock(side_effect=Exception("SearXNG unavailable"))
        mock_searx_class.return_value = mock_searx

        results, error = await _search_with_searx(
            query="test query",
            num_results=5,
            searx_url="http://searx:8080",
            engines=["google"],
            categories=["general"],
        )

        assert results == []
        assert error is not None
        assert "SearXNG unavailable" in str(error)


class TestNormalizeTavilyResults:
    """Tests for _normalize_tavily_results function."""

    def test_normalize_standard_response(self):
        """Standard Tavily response is normalized correctly."""
        tavily_response = {
            "results": [
                {
                    "title": "Test Page",
                    "url": "https://example.com",
                    "content": "This is test content",
                    "score": 0.95,
                }
            ]
        }

        normalized = _normalize_tavily_results(tavily_response)

        assert len(normalized) == 1
        assert normalized[0]["title"] == "Test Page"
        assert normalized[0]["link"] == "https://example.com"
        assert normalized[0]["snippet"] == "This is test content"
        assert normalized[0]["score"] == 0.95
        assert normalized[0]["source"] == "tavily"

    def test_normalize_empty_response(self):
        """Empty Tavily response returns empty list."""
        tavily_response = {"results": []}

        normalized = _normalize_tavily_results(tavily_response)

        assert normalized == []

    def test_normalize_missing_fields(self):
        """Missing fields in Tavily response use defaults."""
        tavily_response = {"results": [{"title": "Only Title"}]}

        normalized = _normalize_tavily_results(tavily_response)

        assert len(normalized) == 1
        assert normalized[0]["title"] == "Only Title"
        assert normalized[0]["link"] == ""
        assert normalized[0]["snippet"] == ""
        assert normalized[0]["score"] == 0.0
        assert normalized[0]["source"] == "tavily"

    def test_normalize_no_results_key(self):
        """Response without 'results' key returns empty list."""
        tavily_response = {}

        normalized = _normalize_tavily_results(tavily_response)

        assert normalized == []


class TestSearchWithTavily:
    """Tests for _search_with_tavily helper function."""

    @pytest.mark.asyncio
    async def test_tavily_success_returns_normalized_results(self):
        """Tavily returns results and they are normalized."""
        # Patch at the source module where TavilySearch is imported from
        with patch("langchain_tavily.TavilySearch") as mock_tavily:
            mock_instance = MagicMock()
            mock_instance.ainvoke = AsyncMock(
                return_value={
                    "results": [
                        {
                            "title": "Tavily Result",
                            "url": "https://tavily.com",
                            "content": "Tavily content",
                            "score": 0.9,
                        }
                    ]
                }
            )
            mock_tavily.return_value = mock_instance

            results, error = await _search_with_tavily(
                query="test query", num_results=5, api_key="test-api-key"
            )

            assert len(results) == 1
            assert results[0]["title"] == "Tavily Result"
            assert results[0]["link"] == "https://tavily.com"
            assert results[0]["source"] == "tavily"
            assert error is None

    @pytest.mark.asyncio
    async def test_tavily_exception_returns_error(self):
        """Tavily throws exception, error is captured."""
        with patch("langchain_tavily.TavilySearch") as mock_tavily:
            mock_tavily.side_effect = Exception("Tavily API error")

            results, error = await _search_with_tavily(
                query="test query", num_results=5, api_key="test-api-key"
            )

            assert results == []
            assert error is not None
            assert "Tavily API error" in str(error)


class TestWebSearchTool:
    """Tests for web_search tool with fallback behavior."""

    @pytest.mark.asyncio
    @patch("src.tools.search._search_with_searx")
    async def test_searx_success_no_fallback(self, mock_searx):
        """When SearXNG returns results, Tavily is not called."""
        mock_searx.return_value = (
            [{"title": "SearXNG Result", "link": "http://searx.com"}],
            None,
        )

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            with patch("src.constants.TAVILY_API_KEY", "test-key"):
                with patch("src.tools.search._search_with_tavily") as mock_tavily:
                    result = await web_search.ainvoke({"query": "test query"})

                    assert len(result) == 1
                    assert result[0]["title"] == "SearXNG Result"
                    mock_tavily.assert_not_called()

    @pytest.mark.asyncio
    @patch("src.tools.search._search_with_tavily")
    @patch("src.tools.search._search_with_searx")
    async def test_searx_empty_triggers_tavily_fallback(self, mock_searx, mock_tavily):
        """When SearXNG returns empty, Tavily fallback is triggered."""
        mock_searx.return_value = ([], None)
        mock_tavily.return_value = (
            [
                {
                    "title": "Tavily Result",
                    "link": "http://tavily.com",
                    "source": "tavily",
                }
            ],
            None,
        )

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            with patch("src.constants.TAVILY_API_KEY", "test-key"):
                result = await web_search.ainvoke({"query": "test query"})

                mock_tavily.assert_called_once()
                assert len(result) == 1
                assert result[0]["source"] == "tavily"

    @pytest.mark.asyncio
    @patch("src.tools.search._search_with_tavily")
    @patch("src.tools.search._search_with_searx")
    async def test_searx_error_triggers_tavily_fallback(self, mock_searx, mock_tavily):
        """When SearXNG throws exception, Tavily fallback is triggered."""
        mock_searx.return_value = ([], Exception("SearXNG down"))
        mock_tavily.return_value = (
            [
                {
                    "title": "Tavily Result",
                    "link": "http://tavily.com",
                    "source": "tavily",
                }
            ],
            None,
        )

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            with patch("src.constants.TAVILY_API_KEY", "test-key"):
                result = await web_search.ainvoke({"query": "test query"})

                mock_tavily.assert_called_once()
                assert len(result) == 1

    @pytest.mark.asyncio
    async def test_no_providers_raises_tool_exception(self):
        """When no providers are configured, ToolException is raised."""
        with patch("src.constants.SEARX_SEARCH_HOST_URL", None):
            with patch("src.constants.TAVILY_API_KEY", None):
                with pytest.raises(ToolException) as exc_info:
                    await web_search.ainvoke({"query": "test query"})

                assert "No search providers configured" in str(exc_info.value)

    @pytest.mark.asyncio
    @patch("src.tools.search._search_with_tavily")
    @patch("src.tools.search._search_with_searx")
    async def test_all_providers_fail_returns_empty(self, mock_searx, mock_tavily):
        """When all providers fail/empty, return empty list (not exception)."""
        mock_searx.return_value = ([], Exception("SearXNG failed"))
        mock_tavily.return_value = ([], Exception("Tavily failed"))

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            with patch("src.constants.TAVILY_API_KEY", "test-key"):
                result = await web_search.ainvoke({"query": "test query"})

                # Should return empty list, not raise exception
                assert result == []

    @pytest.mark.asyncio
    @patch("src.tools.search._search_with_tavily")
    async def test_only_tavily_configured_works(self, mock_tavily):
        """When only Tavily is configured, it's used as primary."""
        mock_tavily.return_value = (
            [{"title": "Tavily Only", "link": "http://tavily.com", "source": "tavily"}],
            None,
        )

        with patch("src.constants.SEARX_SEARCH_HOST_URL", None):
            with patch("src.constants.TAVILY_API_KEY", "test-key"):
                result = await web_search.ainvoke({"query": "test query"})

                assert len(result) == 1
                assert result[0]["source"] == "tavily"
