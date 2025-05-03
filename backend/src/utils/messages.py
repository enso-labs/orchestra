from langchain_core.messages import AnyMessage, HumanMessage
from src.utils.format import get_base64_image

# TODO: Needs to be renamed to not get mixed up
def messages(
    query: str, 
    images: list[str] = None,
    base64_encode: bool = False
) -> list[AnyMessage]:
    # Create message content based on whether images are present
    if images:
        content = [
            {"type": "text", "text": query}
        ]
        
        for image in images:
            if base64_encode:
                encoded_image = get_base64_image(image)
                if encoded_image:  # Only add if encoding was successful
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": encoded_image,
                            "detail": "auto"
                        }
                    })
            else:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image,
                        "detail": "auto"
                    }
                })
    else:
        content = query

    messages = [HumanMessage(content=content)]
    return messages

def existing_thread(
    query: str, 
    images: list[str] = None,
    base64_encode: bool = False
) -> list[AnyMessage]:
    # Create message content based on whether images are present
    if images:
        content = [
            {"type": "text", "text": query}
        ]
        
        for image in images:
            if base64_encode:
                encoded_image = get_base64_image(image)
                if encoded_image:  # Only add if encoding was successful
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": encoded_image,
                            "detail": "auto"
                        }
                    })
            else:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image,
                        "detail": "auto"
                    }
                })
    else:
        content = query

    messages = [HumanMessage(content=content)]
    return messages