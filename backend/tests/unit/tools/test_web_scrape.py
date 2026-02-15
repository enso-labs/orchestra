"""
Unit tests for the web scrape pipeline: fetch_content, content_to_markdown,
and helper functions (strip_control_chars, looks_binary, clean_markdown).
"""

import pytest
from unittest.mock import AsyncMock

import httpx

from src.tools.search import (
    FetchResult,
    _resolve_content_type,
    fetch_content,
    content_to_markdown,
    strip_control_chars,
    looks_binary,
    clean_markdown,
)


# -----------------------------
# Helper function tests
# -----------------------------
class TestStripControlChars:
    """Tests for strip_control_chars helper."""

    def test_keeps_normal_text(self):
        assert strip_control_chars("hello world") == "hello world"

    def test_keeps_newlines_and_tabs(self):
        assert strip_control_chars("hello\n\tworld") == "hello\n\tworld"

    def test_removes_control_chars(self):
        # \x00 NUL, \x01 SOH, \x07 BEL
        assert strip_control_chars("he\x00ll\x01o\x07") == "hello"


class TestLooksBinary:
    """Tests for looks_binary helper."""

    def test_empty_data_is_not_binary(self):
        assert looks_binary(b"") is False

    def test_text_data_is_not_binary(self):
        assert looks_binary(b"Hello, this is plain text\n") is False

    def test_binary_data_detected(self):
        # Lots of null bytes
        assert looks_binary(b"\x00\x01\x02\x03" * 100) is True

    def test_html_is_not_binary(self):
        assert looks_binary(b"<html><body>Hello</body></html>") is False


class TestCleanMarkdown:
    """Tests for clean_markdown helper."""

    def test_collapses_excessive_newlines(self):
        result = clean_markdown("a\n\n\n\nb")
        assert result == "a\n\nb"

    def test_strips_trailing_whitespace(self):
        result = clean_markdown("hello   \nworld   ")
        assert result == "hello\nworld"

    def test_normalizes_line_endings(self):
        result = clean_markdown("a\r\nb\rc")
        assert result == "a\nb\nc"


# -----------------------------
# _resolve_content_type tests
# -----------------------------
class TestResolveContentType:
    """Tests for _resolve_content_type."""

    def test_html(self):
        assert _resolve_content_type("text/html") == "html"

    def test_plain(self):
        assert _resolve_content_type("text/plain") == "plain"

    def test_json(self):
        assert _resolve_content_type("application/json") == "json"

    def test_xml(self):
        assert _resolve_content_type("application/xml") == "xml"

    def test_charset_stripped(self):
        assert _resolve_content_type("text/plain; charset=utf-8") == "plain"

    def test_unknown_text_falls_back_to_plain(self):
        assert _resolve_content_type("text/x-custom") == "plain"

    def test_binary_rejected(self):
        with pytest.raises(ValueError, match="Non-text content-type"):
            _resolve_content_type("image/png")

    def test_empty_rejected(self):
        with pytest.raises(ValueError, match="Non-text content-type"):
            _resolve_content_type("")


# -----------------------------
# fetch_content tests
# -----------------------------
class TestFetchContent:
    """Tests for fetch_content function."""

    def _make_response(self, content: bytes, content_type: str, status_code: int = 200):
        """Create a mock httpx.Response."""
        request = httpx.Request("GET", "http://example.com")
        response = httpx.Response(
            status_code=status_code,
            content=content,
            headers={"content-type": content_type},
            request=request,
        )
        return response

    @pytest.mark.asyncio
    async def test_html_response_accepted(self):
        client = AsyncMock()
        client.get.return_value = self._make_response(b"<html><body>Hello</body></html>", "text/html; charset=utf-8")
        result = await fetch_content(client, "http://example.com")
        assert result.content_type == "html"
        assert "Hello" in result.text

    @pytest.mark.asyncio
    async def test_plain_text_accepted(self):
        client = AsyncMock()
        client.get.return_value = self._make_response(b"Hello plain text", "text/plain")
        result = await fetch_content(client, "http://example.com")
        assert result.content_type == "plain"
        assert "Hello plain text" in result.text

    @pytest.mark.asyncio
    async def test_json_accepted(self):
        client = AsyncMock()
        client.get.return_value = self._make_response(b'{"key": "value"}', "application/json")
        result = await fetch_content(client, "http://example.com")
        assert result.content_type == "json"

    @pytest.mark.asyncio
    async def test_charset_stripped(self):
        client = AsyncMock()
        client.get.return_value = self._make_response(b"plain content", "text/plain; charset=utf-8")
        result = await fetch_content(client, "http://example.com")
        assert result.content_type == "plain"

    @pytest.mark.asyncio
    async def test_image_rejected(self):
        client = AsyncMock()
        client.get.return_value = self._make_response(b"\x89PNG\r\n", "image/png")
        with pytest.raises(ValueError, match="Non-text content-type"):
            await fetch_content(client, "http://example.com")

    @pytest.mark.asyncio
    async def test_binary_payload_rejected(self):
        client = AsyncMock()
        # text/html header but binary content
        client.get.return_value = self._make_response(b"\x00\x01\x02\x03" * 500, "text/html")
        with pytest.raises(ValueError, match="binary"):
            await fetch_content(client, "http://example.com")

    @pytest.mark.asyncio
    async def test_missing_content_type_rejected(self):
        request = httpx.Request("GET", "http://example.com")
        response = httpx.Response(
            status_code=200,
            content=b"some text",
            headers={},
            request=request,
        )
        client = AsyncMock()
        client.get.return_value = response
        with pytest.raises(ValueError, match="Non-text content-type"):
            await fetch_content(client, "http://example.com")


# -----------------------------
# content_to_markdown tests
# -----------------------------
class TestContentToMarkdown:
    """Tests for content_to_markdown routing function."""

    @pytest.mark.asyncio
    async def test_html_routes_through_html_to_markdown(self):
        result = FetchResult(text="<h1>Title</h1><p>Body</p>", content_type="html")
        md = await content_to_markdown(result)
        # Should contain converted markdown, not raw HTML
        assert "Title" in md
        assert "<h1>" not in md

    @pytest.mark.asyncio
    async def test_plain_text_returned_cleaned(self):
        result = FetchResult(text="Hello\n\n\n\nworld", content_type="plain")
        md = await content_to_markdown(result)
        assert md == "Hello\n\nworld"

    @pytest.mark.asyncio
    async def test_json_wrapped_in_code_block(self):
        result = FetchResult(text='{"key": "value"}', content_type="json")
        md = await content_to_markdown(result)
        assert md.startswith("```json\n")
        assert md.endswith("\n```")
        assert '{"key": "value"}' in md

    @pytest.mark.asyncio
    async def test_xml_wrapped_in_code_block(self):
        result = FetchResult(text="<root><item/></root>", content_type="xml")
        md = await content_to_markdown(result)
        assert md.startswith("```xml\n")
        assert md.endswith("\n```")

    @pytest.mark.asyncio
    async def test_csv_wrapped_in_code_block(self):
        result = FetchResult(text="a,b,c\n1,2,3", content_type="csv")
        md = await content_to_markdown(result)
        assert md.startswith("```csv\n")
        assert md.endswith("\n```")

    @pytest.mark.asyncio
    async def test_markdown_returned_cleaned(self):
        result = FetchResult(text="# Title\n\nBody", content_type="markdown")
        md = await content_to_markdown(result)
        assert "# Title" in md
