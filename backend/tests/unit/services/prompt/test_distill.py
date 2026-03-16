"""Unit tests for the distillation pipeline (trajectory extraction and PromptOptimizer.distill)."""

import unittest
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from langgraph.store.memory import InMemoryStore
from langmem.prompts.types import AnnotatedTrajectory

from src.services.prompt.optimize import PromptOptimizer
from src.workers.tasks import _extract_text_content


# ---------------------------------------------------------------------------
# Helper: create an async context manager that yields a given store
# ---------------------------------------------------------------------------


def _mock_store_ctx(store):
    """Create a mock for get_store_db() that yields the given store."""

    @asynccontextmanager
    async def _ctx():
        yield store

    return _ctx


# ---------------------------------------------------------------------------
# _extract_text_content helper
# ---------------------------------------------------------------------------


class TestExtractTextContent(unittest.TestCase):
    """Tests for the _extract_text_content helper in tasks.py."""

    def test_string_content(self):
        """String content is returned as-is."""
        self.assertEqual(_extract_text_content("Hello world"), "Hello world")

    def test_empty_string(self):
        """Empty string returns empty string."""
        self.assertEqual(_extract_text_content(""), "")

    def test_none_content(self):
        """None content returns empty string."""
        self.assertEqual(_extract_text_content(None), "")

    def test_list_of_text_blocks(self):
        """List of content blocks extracts text fields."""
        blocks = [{"type": "text", "text": "Hello"}, {"type": "text", "text": " world"}]
        self.assertEqual(_extract_text_content(blocks), "Hello  world")

    def test_list_with_missing_text(self):
        """Content blocks without text field use empty string."""
        blocks = [{"type": "image_url", "url": "http://example.com/img.png"}]
        self.assertEqual(_extract_text_content(blocks), "")

    def test_list_with_non_dict_elements(self):
        """Non-dict elements in list are stringified."""
        self.assertEqual(_extract_text_content(["plain", "text"]), "plain text")

    def test_integer_content(self):
        """Non-string/non-list content is stringified."""
        self.assertEqual(_extract_text_content(42), "42")


# ---------------------------------------------------------------------------
# extract_trajectory task
# ---------------------------------------------------------------------------


class TestExtractTrajectory(unittest.IsolatedAsyncioTestCase):
    """Tests for the extract_trajectory TaskIQ task."""

    def _make_msg(self, msg_type: str, content) -> dict:
        return {"type": msg_type, "content": content}

    async def _run_extraction(self, store, thread, **kwargs):
        """Run extract_trajectory with mocked store and thread service."""
        from src.workers.tasks import extract_trajectory

        with (
            patch("src.services.db.get_store_db", _mock_store_ctx(store)),
            patch("src.services.thread.ThreadService") as MockTS,
        ):
            mock_ts = AsyncMock()
            mock_ts.get.return_value = thread
            MockTS.return_value = mock_ts
            return await extract_trajectory(
                thread_id=kwargs.get("thread_id", str(uuid4())),
                user_id=kwargs.get("user_id", str(uuid4())),
                assistant_id=kwargs.get("assistant_id", str(uuid4())),
            )

    async def test_formats_human_and_ai_messages(self):
        """Human/AI messages are mapped to user/assistant roles correctly."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        thread = SimpleNamespace(
            messages=[
                self._make_msg("human", "What is Python?"),
                self._make_msg("ai", "Python is a programming language."),
                self._make_msg("human", "Tell me more."),
                self._make_msg("ai", "It is widely used for web development."),
            ]
        )

        result = await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["conversation_length"], 4)

        # Verify stored trajectory
        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        self.assertEqual(len(items), 1)

        stored = items[0].dict()["value"]
        self.assertEqual(len(stored["messages"]), 4)
        self.assertEqual(stored["messages"][0], {"role": "user", "content": "What is Python?"})
        self.assertEqual(stored["messages"][1], {"role": "assistant", "content": "Python is a programming language."})

    async def test_tool_success_rate_all_success(self):
        """tool_success_rate is 1.0 when all tool messages succeed."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        thread = SimpleNamespace(
            messages=[
                self._make_msg("human", "Search for cats"),
                self._make_msg("tool", "Found 5 results for cats"),
                self._make_msg("ai", "I found 5 results about cats."),
            ]
        )

        result = await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["conversation_length"], 2)

        # Verify tool_success_rate in feedback
        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        stored = items[0].dict()["value"]
        self.assertEqual(stored["feedback"]["tool_success_rate"], 1.0)

    async def test_tool_success_rate_with_failures(self):
        """tool_success_rate reflects error/exception/traceback/failed keywords."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        thread = SimpleNamespace(
            messages=[
                self._make_msg("human", "Run the analysis"),
                self._make_msg("tool", "Analysis complete: 42 results"),
                self._make_msg("tool", "Error: connection timeout"),
                self._make_msg("tool", "Traceback (most recent call last): ..."),
                self._make_msg("ai", "I ran into some issues."),
            ]
        )

        result = await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        self.assertEqual(result["status"], "success")

        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        stored = items[0].dict()["value"]
        feedback = stored["feedback"]

        # 3 tool messages, 2 errors → success rate = 1/3 ≈ 0.333
        self.assertAlmostEqual(feedback["tool_success_rate"], 0.333, places=3)
        self.assertEqual(feedback["conversation_length"], 2)

    async def test_hitl_rejections_detected(self):
        """HITL rejections are counted from human messages containing 'rejected this action'."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        thread = SimpleNamespace(
            messages=[
                self._make_msg("human", "Do something"),
                self._make_msg("ai", "I'll delete the database."),
                self._make_msg("human", "The user rejected this action."),
                self._make_msg("ai", "Okay, I won't delete it."),
                self._make_msg("human", "The user rejected this action again."),
                self._make_msg("ai", "Understood, no deletion."),
            ]
        )

        result = await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        self.assertEqual(result["status"], "success")

        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        stored = items[0].dict()["value"]
        feedback = stored["feedback"]

        self.assertEqual(feedback["hitl_rejections"], 2)
        self.assertEqual(feedback["conversation_length"], 6)

    async def test_no_hitl_rejections_omitted(self):
        """hitl_rejections key is omitted from feedback when count is 0."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        thread = SimpleNamespace(
            messages=[
                self._make_msg("human", "Hello"),
                self._make_msg("ai", "Hi there!"),
            ]
        )

        await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        stored = items[0].dict()["value"]
        feedback = stored["feedback"]

        self.assertNotIn("hitl_rejections", feedback)
        self.assertNotIn("tool_success_rate", feedback)

    async def test_skips_when_no_messages(self):
        """Returns skipped status when thread has no messages."""
        store = InMemoryStore()
        thread = SimpleNamespace(messages=None)

        result = await self._run_extraction(store, thread)

        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "no_messages")

    async def test_skips_when_only_tool_messages(self):
        """Returns skipped when thread has only tool messages (no user/assistant)."""
        store = InMemoryStore()

        thread = SimpleNamespace(
            messages=[
                self._make_msg("tool", "result1"),
                self._make_msg("tool", "result2"),
            ]
        )

        result = await self._run_extraction(store, thread)

        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "no_trajectory_messages")

    async def test_handles_object_style_messages(self):
        """Messages with attribute-style access (getattr) are handled correctly."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        msg1 = SimpleNamespace(type="human", content="Hi there")
        msg2 = SimpleNamespace(type="ai", content="Hello!")

        thread = SimpleNamespace(messages=[msg1, msg2])

        result = await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        self.assertEqual(result["status"], "success")
        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        stored = items[0].dict()["value"]
        self.assertEqual(stored["messages"][0]["role"], "user")
        self.assertEqual(stored["messages"][1]["role"], "assistant")

    async def test_multimodal_content_extraction(self):
        """Multimodal content blocks are flattened to text."""
        store = InMemoryStore()
        user_id = str(uuid4())
        assistant_id = str(uuid4())

        thread = SimpleNamespace(
            messages=[
                {"type": "human", "content": [{"type": "text", "text": "Look at this"}, {"type": "image_url"}]},
                {"type": "ai", "content": "I see the image."},
            ]
        )

        result = await self._run_extraction(store, thread, user_id=user_id, assistant_id=assistant_id)

        self.assertEqual(result["status"], "success")
        ns = (user_id, "trajectories", assistant_id)
        items = await store.asearch(ns, limit=10)
        stored = items[0].dict()["value"]
        self.assertIn("Look at this", stored["messages"][0]["content"])

    async def test_extraction_error_returns_error_status(self):
        """Extraction errors are caught and returned as error status (never raise)."""
        from src.workers.tasks import extract_trajectory

        @asynccontextmanager
        async def _failing_ctx():
            raise RuntimeError("DB down")
            yield  # noqa: F541

        with patch("src.services.db.get_store_db", _failing_ctx):
            result = await extract_trajectory(
                thread_id=str(uuid4()),
                user_id=str(uuid4()),
                assistant_id=str(uuid4()),
            )

        self.assertEqual(result["status"], "error")
        self.assertIn("DB down", result["error"])


# ---------------------------------------------------------------------------
# PromptOptimizer.distill
# ---------------------------------------------------------------------------


class TestDistill(unittest.IsolatedAsyncioTestCase):
    """Tests for PromptOptimizer.distill()."""

    async def asyncSetUp(self):
        self.store = InMemoryStore()
        self.user_id = str(uuid4())
        self.assistant_id = str(uuid4())
        self.optimizer = PromptOptimizer(model="gpt-4o-mini")

        # Seed an assistant in the store
        self.assistant_data = {
            "name": "Test Bot",
            "description": "A test bot",
            "system_prompt": "You are a helpful assistant.",
            "instructions": None,
            "tools": [],
            "public": False,
            "model": "gpt-4o-mini",
            "fork_count": 0,
            "tags": [],
        }
        ns = (self.user_id, "assistants")
        await self.store.aput(namespace=ns, key=self.assistant_id, value=self.assistant_data)

    async def _seed_trajectories(self, count: int = 3):
        """Seed sample trajectories into the store."""
        ns = (self.user_id, "trajectories", self.assistant_id)
        for i in range(count):
            trajectory = AnnotatedTrajectory(
                messages=[
                    {"role": "user", "content": f"Question {i}"},
                    {"role": "assistant", "content": f"Answer {i}"},
                ],
                feedback={"conversation_length": 2, "tool_success_rate": 1.0},
            )
            await self.store.aput(namespace=ns, key=str(uuid4()), value=trajectory._asdict())

    async def test_returns_none_when_no_trajectories(self):
        """distill() returns None when no trajectories exist for the assistant."""
        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )
        self.assertIsNone(result)

    async def test_returns_none_when_assistant_not_found(self):
        """distill() returns None when the assistant doesn't exist."""
        ns = (self.user_id, "trajectories", "nonexistent-id")
        trajectory = AnnotatedTrajectory(
            messages=[{"role": "user", "content": "Hello"}],
        )
        await self.store.aput(namespace=ns, key=str(uuid4()), value=trajectory._asdict())

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id="nonexistent-id",
            store=self.store,
        )
        self.assertIsNone(result)

    async def test_returns_none_when_no_prompt(self):
        """distill() returns None when assistant has no system_prompt or instructions."""
        ns = (self.user_id, "assistants")
        no_prompt_data = {**self.assistant_data, "system_prompt": None, "instructions": None}
        await self.store.aput(namespace=ns, key=self.assistant_id, value=no_prompt_data)

        await self._seed_trajectories(1)

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )
        self.assertIsNone(result)

    @patch.object(PromptOptimizer, "optimize")
    async def test_returns_none_when_no_improvement(self, mock_optimize):
        """distill() returns None when optimizer returns the same prompt."""
        await self._seed_trajectories(2)

        mock_optimize.return_value = {"prompt": "You are a helpful assistant."}

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )
        self.assertIsNone(result)

    @patch("src.services.prompt.PromptService")
    @patch.object(PromptOptimizer, "optimize")
    async def test_creates_revision_when_improved(self, mock_optimize, MockPromptService):
        """distill() creates a new prompt revision and updates assistant when optimizer improves."""
        await self._seed_trajectories(3)

        mock_optimize.return_value = {"prompt": "You are an expert assistant. Always provide citations."}

        mock_ps = AsyncMock()
        mock_ps.list_revisions.return_value = []
        mock_ps.revision.return_value = 1
        MockPromptService.return_value = mock_ps

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )

        self.assertEqual(result, 1)
        mock_ps.revision.assert_called_once()
        mock_optimize.assert_called_once()

        # Verify assistant was updated with new prompt
        ns = (self.user_id, "assistants")
        items = await self.store.asearch(ns, limit=10)
        found = [item for item in items if item.key == self.assistant_id]
        self.assertTrue(len(found) > 0)
        updated = found[0].dict()["value"]
        self.assertEqual(updated["system_prompt"], "You are an expert assistant. Always provide citations.")
        self.assertIsNone(updated["instructions"])

    @patch("src.services.prompt.PromptService")
    @patch.object(PromptOptimizer, "optimize")
    async def test_handles_string_optimizer_output(self, mock_optimize, MockPromptService):
        """distill() handles when optimizer returns a plain string instead of dict."""
        await self._seed_trajectories(2)

        mock_optimize.return_value = "You are a highly improved assistant."

        mock_ps = AsyncMock()
        mock_ps.list_revisions.return_value = []
        mock_ps.revision.return_value = 1
        MockPromptService.return_value = mock_ps

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )

        self.assertEqual(result, 1)

    @patch("src.services.prompt.PromptService")
    @patch.object(PromptOptimizer, "optimize")
    async def test_increments_version_from_existing(self, mock_optimize, MockPromptService):
        """distill() passes latest version to revision data for incrementing."""
        await self._seed_trajectories(2)

        mock_optimize.return_value = {"prompt": "Improved prompt v2."}

        mock_revision = MagicMock()
        mock_revision.v = 3
        mock_ps = AsyncMock()
        mock_ps.list_revisions.return_value = [mock_revision]
        mock_ps.revision.return_value = 4
        MockPromptService.return_value = mock_ps

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )

        self.assertEqual(result, 4)
        call_args = mock_ps.revision.call_args
        revision_data = call_args[0][1]
        self.assertEqual(revision_data.v, 3)

    @patch.object(PromptOptimizer, "optimize")
    async def test_returns_none_on_optimizer_exception(self, mock_optimize):
        """distill() returns None when optimizer raises an exception (never propagates)."""
        await self._seed_trajectories(2)
        mock_optimize.side_effect = RuntimeError("LLM API down")

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )

        self.assertIsNone(result)

    @patch("src.services.prompt.PromptService")
    @patch.object(PromptOptimizer, "optimize")
    async def test_returns_none_when_revision_fails(self, mock_optimize, MockPromptService):
        """distill() returns None when PromptService.revision() fails."""
        await self._seed_trajectories(2)

        mock_optimize.return_value = {"prompt": "Better prompt."}

        mock_ps = AsyncMock()
        mock_ps.list_revisions.return_value = []
        mock_ps.revision.return_value = False
        MockPromptService.return_value = mock_ps

        result = await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )

        self.assertIsNone(result)

    @patch("src.services.prompt.PromptService")
    @patch.object(PromptOptimizer, "optimize")
    async def test_passes_trajectories_to_optimizer(self, mock_optimize, MockPromptService):
        """distill() passes the correct trajectories and prompt to the optimizer."""
        await self._seed_trajectories(3)

        mock_optimize.return_value = {"prompt": "New improved prompt."}

        mock_ps = AsyncMock()
        mock_ps.list_revisions.return_value = []
        mock_ps.revision.return_value = 1
        MockPromptService.return_value = mock_ps

        await self.optimizer.distill(
            user_id=self.user_id,
            assistant_id=self.assistant_id,
            store=self.store,
        )

        mock_optimize.assert_called_once()
        optimizer_input = mock_optimize.call_args[0][0]
        self.assertEqual(len(optimizer_input["trajectories"]), 3)
        self.assertEqual(optimizer_input["prompt"]["name"], "Test Bot")
        self.assertEqual(optimizer_input["prompt"]["prompt"], "You are a helpful assistant.")


if __name__ == "__main__":
    unittest.main()
