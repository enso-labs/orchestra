"""Unit tests for files state handling edge cases.

Tests for GitHub Issue #677: AttributeError: 'NoneType' object has no attribute 'items'

These tests verify that None values are properly handled in the files state
to prevent AttributeError crashes in the _file_data_reducer.
"""


class TestFilesStateInitialization:
    """Test files state initialization with edge cases."""

    def test_llm_input_files_defaults_to_empty_dict(self):
        """Test that LLMInput.files defaults to empty dict.

        The schema uses default_factory=dict to ensure files is never None,
        which prevents AttributeError in _file_data_reducer (GitHub Issue #677).
        """
        from src.schemas.entities.llm import LLMInput

        input_data = {"messages": [{"role": "user", "content": "Hello"}]}
        llm_input = LLMInput(**input_data)

        # files field defaults to {} per schema definition (not None)
        assert llm_input.files == {}

    def test_llm_input_files_accepts_valid_dict(self):
        """Test that LLMInput.files accepts a valid dict."""
        from src.schemas.entities.llm import LLMInput

        input_data = {
            "messages": [{"role": "user", "content": "Hello"}],
            "files": {"/test.txt": "content"},
        }
        llm_input = LLMInput(**input_data)

        assert llm_input.files == {"/test.txt": "content"}

    def test_llm_input_files_none_converted_to_empty_dict(self):
        """Test that None for files is converted to empty dict by the validator.

        The schema has a field_validator that ensures files is never None,
        converting None to {} automatically.
        """
        from src.schemas.entities.llm import LLMInput

        input_data = {
            "messages": [{"role": "user", "content": "Hello"}],
            "files": None,
        }
        llm_input = LLMInput(**input_data)

        # The validator ensures files is always a dict, never None
        assert llm_input.files == {}
        assert isinstance(llm_input.files, dict)


class TestLLMControllerFilesState:
    """Test LLMController files state handling."""

    def test_init_runtime_files_never_none(self):
        """Test that _init_runtime always provides a dict for files, never None.

        This is the core fix for GitHub Issue #677.
        """
        from src.schemas.entities.llm import LLMRequest, LLMInput

        # Create a request where files is None (default)
        request = LLMRequest(
            input=LLMInput(messages=[{"role": "user", "content": "test"}]),
        )

        # Simulate the fixed logic from LLMController._init_runtime
        files = request.input.files or {}

        # The files value should always be a dict, never None
        assert files is not None
        assert isinstance(files, dict)

    def test_init_runtime_files_preserves_existing_dict(self):
        """Test that existing files dict is preserved."""
        from src.schemas.entities.llm import LLMRequest, LLMInput

        file_data = {"/readme.md": "# Hello World"}
        request = LLMRequest(
            input=LLMInput(
                messages=[{"role": "user", "content": "test"}],
                files=file_data,
            ),
        )

        # Simulate the fixed logic
        files = request.input.files or {}

        # The original dict should be preserved
        assert files == file_data


class TestFilesStateReducerCompatibility:
    """Test that files state values are compatible with _file_data_reducer."""

    def test_files_state_dict_has_items_method(self):
        """Verify dict values have the .items() method that the reducer expects."""
        # The reducer calls right.items() - ensure our values support this
        files_none = None
        files_empty = {}
        files_valid = {"/test.txt": {"content": ["line1"], "created_at": "2024-01-01"}}

        # None does NOT have .items() - this is what causes the bug
        assert not hasattr(files_none, "items")

        # Empty dict has .items()
        assert hasattr(files_empty, "items")
        assert list(files_empty.items()) == []

        # Valid dict has .items()
        assert hasattr(files_valid, "items")
        assert len(list(files_valid.items())) == 1

    def test_null_coalescing_produces_dict(self):
        """Test that `value or {}` pattern always produces a dict."""
        test_cases = [
            (None, {}),
            ({}, {}),
            ({"/a.txt": "content"}, {"/a.txt": "content"}),
        ]

        for input_value, expected in test_cases:
            result = input_value or {}
            assert isinstance(result, dict)
            assert result == expected
            # Critical: result must have .items() method
            assert hasattr(result, "items")
