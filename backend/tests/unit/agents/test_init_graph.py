"""Integration tests verifying new deep agent parameters flow from init_graph() to create_deep_agent()."""

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


if __name__ == "__main__":
    unittest.main()
