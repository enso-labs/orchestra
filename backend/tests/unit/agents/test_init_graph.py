"""Integration tests verifying new deep agent parameters flow from init_graph() to create_deep_agent()."""

import os
import unittest
from unittest.mock import patch, MagicMock


class TestInitGraphParameterPropagation(unittest.TestCase):
    """Verify init_graph() forwards skills, memory, name, response_format, interrupt_on to create_deep_agent()."""

    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_passes_all_new_params(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When all five new params are provided, they are forwarded to create_deep_agent()."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        skills_val = ["web_search", "code_exec"]
        memory_val = ["Remember user prefers JSON"]
        name_val = "my-deep-agent"
        response_format_val = {"type": "json_object", "schema": {"answer": "string"}}
        interrupt_on_val = {"tool_calls": ["http_request"]}

        init_graph(
            middleware=[],
            skills=skills_val,
            memory=memory_val,
            name=name_val,
            response_format=response_format_val,
            interrupt_on=interrupt_on_val,
        )

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs
        self.assertEqual(call_kwargs["skills"], skills_val)
        self.assertEqual(call_kwargs["memory"], memory_val)
        self.assertEqual(call_kwargs["name"], name_val)
        self.assertEqual(call_kwargs["response_format"], response_format_val)
        self.assertEqual(call_kwargs["interrupt_on"], interrupt_on_val)

    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_passes_none_defaults(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When no new params are provided, None defaults are forwarded to create_deep_agent()."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        init_graph(middleware=[])

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs
        self.assertIsNone(call_kwargs["skills"])
        self.assertIsNone(call_kwargs["memory"])
        self.assertIsNone(call_kwargs["name"])
        self.assertIsNone(call_kwargs["response_format"])
        self.assertIsNone(call_kwargs["interrupt_on"])


class TestInitGraphAgentsMdMigration(unittest.TestCase):
    """Verify init_graph() system_prompt -> AGENTS.md migration behavior."""

    @patch.dict("os.environ", {"USE_AGENTS_MD_INSTRUCTIONS": "true"})
    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_agents_md_enabled_does_not_pass_system_prompt(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When USE_AGENTS_MD_INSTRUCTIONS=true, system_prompt=None is passed to create_deep_agent()."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        init_graph(
            middleware=[],
            system_prompt="You are a helpful assistant.",
        )

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs
        self.assertIsNone(call_kwargs["system_prompt"])

    @patch.dict("os.environ", {"USE_AGENTS_MD_INSTRUCTIONS": "true"})
    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_agents_md_enabled_writes_file_and_adds_to_memory(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When USE_AGENTS_MD_INSTRUCTIONS=true, system_prompt content is written to AGENTS.md and path is in memory list."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        prompt_content = "You are a helpful assistant."
        init_graph(
            middleware=[],
            system_prompt=prompt_content,
        )

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs
        memory_list = call_kwargs["memory"]

        # Memory should contain at least the generated AGENTS.md path
        self.assertIsNotNone(memory_list)
        self.assertGreaterEqual(len(memory_list), 1)

        # The first entry should be the AGENTS.md path
        agents_md_path = memory_list[0]
        self.assertTrue(agents_md_path.endswith("AGENTS.md"))
        self.assertTrue(os.path.exists(agents_md_path))

        # File content should contain the system prompt
        with open(agents_md_path, "r") as f:
            content = f.read()
        self.assertIn(prompt_content, content)

    @patch.dict("os.environ", {"USE_AGENTS_MD_INSTRUCTIONS": "false"})
    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_agents_md_disabled_passes_system_prompt_directly(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When USE_AGENTS_MD_INSTRUCTIONS=false, system_prompt is passed directly to create_deep_agent()."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        prompt_content = "You are a helpful assistant."
        init_graph(
            middleware=[],
            system_prompt=prompt_content,
        )

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs
        self.assertEqual(call_kwargs["system_prompt"], prompt_content)

    @patch.dict("os.environ", {"USE_AGENTS_MD_INSTRUCTIONS": "true"})
    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_agents_md_preserves_user_memory_paths(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When USE_AGENTS_MD_INSTRUCTIONS=true, user-provided memory paths are preserved alongside generated AGENTS.md path."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        user_memory = ["/path/to/custom/memory.md", "/path/to/another.md"]
        init_graph(
            middleware=[],
            system_prompt="You are a helpful assistant.",
            memory=user_memory,
        )

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs
        memory_list = call_kwargs["memory"]

        # Memory should contain generated AGENTS.md + user memory paths
        self.assertIsNotNone(memory_list)
        self.assertEqual(len(memory_list), 3)

        # First entry is the generated AGENTS.md
        self.assertTrue(memory_list[0].endswith("AGENTS.md"))

        # User memory paths are preserved after the AGENTS.md path
        self.assertEqual(memory_list[1], "/path/to/custom/memory.md")
        self.assertEqual(memory_list[2], "/path/to/another.md")

    @patch.dict("os.environ", {"USE_AGENTS_MD_INSTRUCTIONS": "true"})
    @patch("src.agents.create_deep_agent")
    @patch("langchain.chat_models.init_chat_model")
    @patch("src.agents.init_default_middleware", return_value=[])
    def test_agents_md_none_system_prompt_no_file_generated(
        self, mock_middleware, mock_init_chat_model, mock_create_deep_agent
    ):
        """When system_prompt is None, no AGENTS.md file is generated even with flag enabled."""
        from src.agents import init_graph

        mock_init_chat_model.return_value = MagicMock()
        mock_create_deep_agent.return_value = MagicMock()

        init_graph(
            middleware=[],
            system_prompt=None,
        )

        mock_create_deep_agent.assert_called_once()
        call_kwargs = mock_create_deep_agent.call_args.kwargs

        # system_prompt should remain None (no migration needed)
        self.assertIsNone(call_kwargs["system_prompt"])

        # memory should be None (no AGENTS.md generated, no user memory)
        self.assertIsNone(call_kwargs["memory"])


if __name__ == "__main__":
    unittest.main()
