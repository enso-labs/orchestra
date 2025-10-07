from typing import Optional, Literal, Dict, Any
from langchain_core.tools import tool, ToolException
from openai import AsyncOpenAI
from src.utils.logger import logger
import os

# Type definitions for image generation parameters
ImageSize = Literal["1024x1024", "1792x1024", "1024x1792", "4096x4096"]
ImageQuality = Literal["standard", "hd"]


@tool
async def generate_image(
    prompt: str,
    size: Optional[ImageSize] = "1024x1024",
    quality: Optional[ImageQuality] = "standard",
) -> Dict[str, Any]:
    """
    Title: Generate Image with OpenAI
    Description: Generate high-quality images using OpenAI's gpt-image-1 model (via GPT-4o).

    This tool creates images from natural language descriptions using OpenAI's
    latest image generation model. It supports various sizes up to 4096x4096
    pixels and can generate images in different styles.

    Use this tool when you need to:
    - Create visualizations, illustrations, or artwork
    - Generate images for presentations or documents
    - Create mockups or design concepts
    - Visualize abstract ideas or concepts

    Tips for best results:
    - Be specific and detailed in your descriptions
    - Mention style, mood, colors, composition
    - Specify important details like lighting, perspective, subject position
    - For complex scenes, describe elements in logical order

    Args:
        prompt (str): Detailed description of the image to generate. Be specific about
            style, composition, colors, mood, and important details.
        size (str, optional): Image dimensions. Options: "1024x1024" (square),
            "1792x1024" (landscape), "1024x1792" (portrait), "4096x4096" (large square).
            Default is "1024x1024".
        quality (str, optional): Image quality level. Options: "standard" (faster, cheaper)
            or "hd" (higher detail, slower, more expensive). Default is "standard".

    Returns:
        dict: A dictionary containing:
            - image_url (str): Direct URL to the generated image
            - image_id (str): Unique ID for referencing in multi-turn generation
            - revised_prompt (str): OpenAI's interpretation/refinement of your prompt
            - size (str): The actual dimensions of the generated image
            - quality (str): The quality setting used

    Example:
        generate_image(
            prompt="A serene mountain landscape at sunset, purple and orange sky, "
                   "snow-capped peaks, photorealistic style, wide angle view",
            size="1792x1024",
            quality="hd"
        )

    Raises:
        ToolException: If API key is missing, rate limit exceeded, content policy
            violation, or other API errors occur.
    """
    try:
        # Get API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ToolException(
                "OPENAI_API_KEY not found in environment variables. "
                "Please configure your OpenAI API key."
            )

        # Initialize OpenAI client
        client = AsyncOpenAI(api_key=api_key)

        logger.info(
            f"Generating image with prompt: '{prompt[:100]}...' size={size} quality={quality}"
        )

        # Map quality to max_completion_tokens (approximate)
        # Images consume tokens - HD quality allows more detail
        max_tokens = 16000 if quality == "hd" else 8000

        # Use Chat Completions API with image modality
        # This is the recommended approach for gpt-image-1 as of 2025
        response = await client.chat.completions.create(
            model="gpt-4o",  # gpt-4o uses gpt-image-1 when image modality is specified
            modalities=["text", "image"],
            messages=[
                {
                    "role": "user",
                    "content": f"Generate an image with these specifications: {prompt}. Size: {size}. Quality: {quality}.",
                }
            ],
            max_completion_tokens=max_tokens,
        )

        # Extract image data from response
        if not response.choices or len(response.choices) == 0:
            raise ToolException("No image generated in API response")

        choice = response.choices[0]
        message = choice.message

        # Parse the response to extract image information
        # The API returns image data in the message content
        image_url = None
        image_id = None
        revised_prompt = prompt  # Default to original if not revised

        # Check if content contains image data
        if hasattr(message, "content"):
            content = message.content

            # Handle different response formats
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "image":
                            image_url = item.get("image_url", {}).get("url")
                            image_id = item.get("image_id")
                        elif item.get("type") == "text":
                            revised_prompt = item.get("text", prompt)
            elif isinstance(content, str):
                # Sometimes content is just text
                revised_prompt = content

        # Some responses have direct attributes
        if hasattr(message, "image_url"):
            image_url = message.image_url
        if hasattr(message, "image_id"):
            image_id = message.image_id

        if not image_url:
            # Log the full response for debugging
            logger.error(f"Failed to extract image URL from response: {response}")
            raise ToolException(
                "Failed to extract image URL from API response. "
                "The image generation may have failed or the response format is unexpected."
            )

        result = {
            "image_url": image_url,
            "image_id": image_id or f"img_{response.id}",  # Fallback ID
            "revised_prompt": revised_prompt,
            "size": size,
            "quality": quality,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens
                if response.usage
                else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            },
        }

        logger.info(f"Successfully generated image: {image_id or 'no-id'}")
        logger.debug(f"Image URL: {image_url}")

        return result

    except ToolException:
        # Re-raise tool exceptions as-is
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error generating image: {error_msg}", exc_info=True)

        # Provide user-friendly error messages
        if "rate_limit" in error_msg.lower():
            raise ToolException(
                "OpenAI rate limit exceeded. Please try again in a few moments."
            )
        elif "insufficient_quota" in error_msg.lower():
            raise ToolException(
                "OpenAI API quota exceeded. Please check your account billing."
            )
        elif "content_policy" in error_msg.lower():
            raise ToolException(
                "The image prompt violates OpenAI's content policy. "
                "Please modify your prompt to comply with usage guidelines."
            )
        elif (
            "invalid_api_key" in error_msg.lower()
            or "authentication" in error_msg.lower()
        ):
            raise ToolException(
                "Invalid OpenAI API key. Please check your configuration."
            )
        else:
            raise ToolException(f"Failed to generate image: {error_msg}")


@tool
async def refine_image(
    image_id: str,
    refinement_prompt: str,
    size: Optional[ImageSize] = None,
) -> Dict[str, Any]:
    """
    Title: Refine Generated Image
    Description: Modify a previously generated image based on new instructions.

    This tool takes an existing image (by its ID from a previous generation) and
    applies modifications based on a refinement prompt. This enables iterative
    image creation where you can make adjustments without starting from scratch.

    Use this for:
    - Making color adjustments to existing images
    - Adding or removing elements
    - Changing style or mood
    - Refining details or composition

    Args:
        image_id (str): The ID of a previously generated image (from generate_image result).
        refinement_prompt (str): Detailed instructions for how to modify the image.
            Be specific about what to change, add, or remove.
        size (str, optional): New size for the refined image. If not specified,
            uses the original image size.

    Returns:
        dict: A dictionary containing the same fields as generate_image:
            - image_url (str): URL to the refined image
            - image_id (str): New ID for the refined image
            - revised_prompt (str): Combined original and refinement prompts
            - size (str): Dimensions of the refined image
            - quality (str): Quality level used

    Example:
        # First generate an image
        result = generate_image(prompt="A red car on a highway")

        # Then refine it
        refined = refine_image(
            image_id=result["image_id"],
            refinement_prompt="Make the car blue and add mountains in background"
        )

    Raises:
        ToolException: If the image_id is invalid or other API errors occur.
    """
    try:
        # Get API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ToolException(
                "OPENAI_API_KEY not found in environment variables. "
                "Please configure your OpenAI API key."
            )

        # Initialize OpenAI client
        client = AsyncOpenAI(api_key=api_key)

        logger.info(
            f"Refining image {image_id} with prompt: '{refinement_prompt[:100]}...'"
        )

        # Build conversation history with the previous image
        messages = [
            {
                "role": "user",
                "content": "Generate an image",  # Placeholder for original generation
            },
            {"role": "assistant", "content": [{"type": "image", "image_id": image_id}]},
            {"role": "user", "content": refinement_prompt},
        ]

        # Add size specification if provided
        if size:
            messages[-1]["content"] += f" Size: {size}."

        # Generate refined image
        response = await client.chat.completions.create(
            model="gpt-4o",
            modalities=["text", "image"],
            messages=messages,
            max_completion_tokens=16000,
        )

        # Extract image data from response (same logic as generate_image)
        if not response.choices or len(response.choices) == 0:
            raise ToolException("No refined image generated in API response")

        choice = response.choices[0]
        message = choice.message

        image_url = None
        new_image_id = None
        revised_prompt = refinement_prompt

        if hasattr(message, "content"):
            content = message.content

            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "image":
                            image_url = item.get("image_url", {}).get("url")
                            new_image_id = item.get("image_id")
                        elif item.get("type") == "text":
                            revised_prompt = item.get("text", refinement_prompt)
            elif isinstance(content, str):
                revised_prompt = content

        if hasattr(message, "image_url"):
            image_url = message.image_url
        if hasattr(message, "image_id"):
            new_image_id = message.image_id

        if not image_url:
            logger.error(
                f"Failed to extract refined image URL from response: {response}"
            )
            raise ToolException(
                "Failed to extract refined image URL from API response."
            )

        result = {
            "image_url": image_url,
            "image_id": new_image_id or f"img_{response.id}",
            "revised_prompt": revised_prompt,
            "original_image_id": image_id,
            "size": size or "1024x1024",  # Default if not specified
            "quality": "standard",  # Refinement typically uses standard
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens
                if response.usage
                else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            },
        }

        logger.info(
            f"Successfully refined image: {image_id} -> {new_image_id or 'no-id'}"
        )
        logger.debug(f"Refined image URL: {image_url}")

        return result

    except ToolException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error refining image: {error_msg}", exc_info=True)

        if "rate_limit" in error_msg.lower():
            raise ToolException(
                "OpenAI rate limit exceeded. Please try again in a few moments."
            )
        elif "content_policy" in error_msg.lower():
            raise ToolException(
                "The refinement prompt violates OpenAI's content policy."
            )
        elif (
            "invalid_image_id" in error_msg.lower()
            or "image not found" in error_msg.lower()
        ):
            raise ToolException(
                f"Invalid image ID: {image_id}. The image may have expired or the ID is incorrect."
            )
        else:
            raise ToolException(f"Failed to refine image: {error_msg}")
