"""Unit tests for LLM controller inference dictation feature.

These are pure unit tests that don't require database or app initialization.
"""



class TestLLMRequestFileGeneration:
    """Test LLMRequest schema with file generation parameters."""

    def test_llm_request_accepts_generate_files_flag(self):
        """Test that LLMRequest schema accepts generate_files parameter."""
        # Import here to avoid conftest import issues
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {
                "messages": [{"role": "user", "content": "Create a Python script"}]
            },
            "generate_files": True,
        }
        request = LLMRequest(**payload)
        assert request.generate_files is True

    def test_llm_request_generate_files_defaults_to_false(self):
        """Test that generate_files defaults to False."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Hello"}]},
        }
        request = LLMRequest(**payload)
        assert request.generate_files is False

    def test_llm_request_accepts_target_file(self):
        """Test that LLMRequest schema accepts target_file parameter."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Write a README"}]},
            "generate_files": True,
            "target_file": "/README.md",
        }
        request = LLMRequest(**payload)
        assert request.target_file == "/README.md"

    def test_llm_request_target_file_defaults_to_none(self):
        """Test that target_file defaults to None."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Hello"}]},
        }
        request = LLMRequest(**payload)
        assert request.target_file is None

    def test_llm_request_accepts_file_context(self):
        """Test that LLMRequest schema accepts file_context parameter."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Add error handling"}]},
            "generate_files": True,
            "target_file": "/main.py",
            "file_context": "def hello():\n    print('hello')",
        }
        request = LLMRequest(**payload)
        assert request.file_context == "def hello():\n    print('hello')"

    def test_llm_request_file_context_defaults_to_none(self):
        """Test that file_context defaults to None."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Hello"}]},
        }
        request = LLMRequest(**payload)
        assert request.file_context is None

    def test_llm_request_with_all_file_generation_params(self):
        """Test LLMRequest with all file generation parameters."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": "Create a Python script that prints hello world",
                    }
                ]
            },
            "generate_files": True,
            "target_file": "/hello.py",
            "file_context": "# Existing code here",
        }
        request = LLMRequest(**payload)

        assert request.generate_files is True
        assert request.target_file == "/hello.py"
        assert request.file_context == "# Existing code here"
        assert (
            request.input.messages[0].content
            == "Create a Python script that prints hello world"
        )
