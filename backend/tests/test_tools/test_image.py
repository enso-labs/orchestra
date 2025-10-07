import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.tools.image import generate_image, refine_image
from langchain_core.tools import ToolException


class TestGenerateImage:
    """Test suite for the generate_image tool"""

    @pytest.mark.asyncio
    async def test_generate_image_basic(self):
        """Test basic image generation with default parameters"""
        # Mock the OpenAI client and response
        mock_response = MagicMock()
        mock_response.id = "test_response_id"
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=[
                        {
                            "type": "image",
                            "image_url": {"url": "https://example.com/image.png"},
                            "image_id": "test_image_id",
                        },
                        {"type": "text", "text": "A beautiful sunset over mountains"},
                    ]
                )
            )
        ]
        mock_response.usage = MagicMock(
            prompt_tokens=100, completion_tokens=200, total_tokens=300
        )

        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                result = await generate_image.ainvoke(
                    {"prompt": "A beautiful sunset over mountains"}
                )

                assert result["image_url"] == "https://example.com/image.png"
                assert result["image_id"] == "test_image_id"
                assert result["revised_prompt"] == "A beautiful sunset over mountains"
                assert result["size"] == "1024x1024"
                assert result["quality"] == "standard"
                assert result["usage"]["total_tokens"] == 300

    @pytest.mark.asyncio
    async def test_generate_image_custom_parameters(self):
        """Test image generation with custom size and quality"""
        mock_response = MagicMock()
        mock_response.id = "test_response_id"
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=[
                        {
                            "type": "image",
                            "image_url": {"url": "https://example.com/hd_image.png"},
                            "image_id": "test_hd_image_id",
                        }
                    ]
                )
            )
        ]
        mock_response.usage = MagicMock(
            prompt_tokens=150, completion_tokens=300, total_tokens=450
        )

        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                result = await generate_image.ainvoke(
                    {
                        "prompt": "A futuristic city",
                        "size": "1792x1024",
                        "quality": "hd",
                    }
                )

                assert result["size"] == "1792x1024"
                assert result["quality"] == "hd"
                assert "image_url" in result

    @pytest.mark.asyncio
    async def test_generate_image_missing_api_key(self):
        """Test error handling when API key is missing"""
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ToolException) as exc_info:
                await generate_image.ainvoke({"prompt": "Test prompt"})

            assert "OPENAI_API_KEY not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_generate_image_rate_limit_error(self):
        """Test error handling for rate limit errors"""
        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=Exception("rate_limit exceeded")
            )
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                with pytest.raises(ToolException) as exc_info:
                    await generate_image.ainvoke({"prompt": "Test prompt"})

                assert "rate limit exceeded" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_generate_image_content_policy_error(self):
        """Test error handling for content policy violations"""
        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=Exception("content_policy violation")
            )
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                with pytest.raises(ToolException) as exc_info:
                    await generate_image.ainvoke({"prompt": "Test prompt"})

                assert "content policy" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_generate_image_no_image_in_response(self):
        """Test error handling when no image is returned"""
        mock_response = MagicMock()
        mock_response.id = "test_response_id"
        mock_response.choices = [
            MagicMock(message=MagicMock(content=[{"type": "text", "text": "No image"}]))
        ]
        mock_response.usage = None

        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                with pytest.raises(ToolException) as exc_info:
                    await generate_image.ainvoke({"prompt": "Test prompt"})

                assert "Failed to extract image URL" in str(exc_info.value)


class TestRefineImage:
    """Test suite for the refine_image tool"""

    @pytest.mark.asyncio
    async def test_refine_image_basic(self):
        """Test basic image refinement"""
        mock_response = MagicMock()
        mock_response.id = "refined_response_id"
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=[
                        {
                            "type": "image",
                            "image_url": {"url": "https://example.com/refined.png"},
                            "image_id": "refined_image_id",
                        }
                    ]
                )
            )
        ]
        mock_response.usage = MagicMock(
            prompt_tokens=200, completion_tokens=400, total_tokens=600
        )

        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                result = await refine_image.ainvoke(
                    {
                        "image_id": "original_image_id",
                        "refinement_prompt": "Make it more colorful",
                    }
                )

                assert result["image_url"] == "https://example.com/refined.png"
                assert result["image_id"] == "refined_image_id"
                assert result["original_image_id"] == "original_image_id"

                # Verify the conversation history was built correctly
                call_args = mock_client.chat.completions.create.call_args
                messages = call_args.kwargs["messages"]
                assert len(messages) == 3
                assert messages[1]["role"] == "assistant"
                assert messages[1]["content"][0]["image_id"] == "original_image_id"
                assert "Make it more colorful" in messages[2]["content"]

    @pytest.mark.asyncio
    async def test_refine_image_with_size(self):
        """Test image refinement with custom size"""
        mock_response = MagicMock()
        mock_response.id = "refined_response_id"
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=[
                        {
                            "type": "image",
                            "image_url": {"url": "https://example.com/refined.png"},
                            "image_id": "refined_image_id",
                        }
                    ]
                )
            )
        ]
        mock_response.usage = None

        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                result = await refine_image.ainvoke(
                    {
                        "image_id": "original_image_id",
                        "refinement_prompt": "Increase resolution",
                        "size": "4096x4096",
                    }
                )

                assert result["size"] == "4096x4096"

    @pytest.mark.asyncio
    async def test_refine_image_invalid_id(self):
        """Test error handling for invalid image ID"""
        with patch("src.tools.image.AsyncOpenAI") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=Exception("invalid_image_id")
            )
            mock_client_class.return_value = mock_client

            with patch.dict("os.environ", {"OPENAI_API_KEY": "test_key"}):
                with pytest.raises(ToolException) as exc_info:
                    await refine_image.ainvoke(
                        {
                            "image_id": "invalid_id",
                            "refinement_prompt": "Make changes",
                        }
                    )

                assert "Invalid image ID" in str(exc_info.value)
