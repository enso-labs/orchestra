"""
Schema resolution and Pydantic model creation utilities.

This module provides functionality for resolving OpenAPI schema references
and dynamically creating Pydantic models from JSON schemas.
"""

from typing import Dict, Any, Type, Optional
from enum import Enum
from pydantic import BaseModel, create_model
from pydantic.fields import Field


def resolve_ref(spec: dict, ref: str) -> dict:
    """
    Resolve a $ref string (e.g., '#/components/schemas/JobCreate') to the actual object in the OpenAPI spec.

    Args:
        spec: The full OpenAPI spec as a dictionary.
        ref: The $ref string to resolve.

    Returns:
        The resolved object (e.g., the schema dict).
        
    Raises:
        ValueError: If the ref is not a local reference
    """
    if not ref.startswith("#/"):
        raise ValueError("Only local refs are supported")
    parts = ref.lstrip("#/").split("/")
    obj = spec
    for part in parts:
        obj = obj[part]
    return obj


def resolve_ref_recursive(spec: dict, obj: dict) -> dict:
    """
    Recursively resolve all $ref values in a schema object using the OpenAPI spec.

    Args:
        spec: The full OpenAPI spec as a dictionary.
        obj: The schema object (may contain $ref).

    Returns:
        The schema object with all $ref values resolved.
    """
    if isinstance(obj, dict):
        if "$ref" in obj:
            # Resolve the reference and recurse
            resolved = resolve_ref(spec, obj["$ref"])
            return resolve_ref_recursive(spec, resolved)
        else:
            # Recurse into all dict values
            return {k: resolve_ref_recursive(spec, v) for k, v in obj.items()}
    elif isinstance(obj, list):
        # Recurse into all list items
        return [resolve_ref_recursive(spec, item) for item in obj]
    else:
        # Base case: return as is
        return obj


def get_field_type(field_type: str) -> Any:
    """
    Map field type strings to actual Python types.
    
    Args:
        field_type: The string representation of the field type
        
    Returns:
        The corresponding Python type
    """
    type_mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "object": Dict[str, Any],
        "array": list
    }
    return type_mapping.get(field_type, Any)


def create_schema(model_name: str, fields_json: Dict[str, Any]) -> Type[BaseModel]:
    """
    Create a Pydantic model dynamically from a JSON object.

    Args:
        model_name: The name of the model.
        fields_json: A dictionary representing the fields from a JSON object.
        
    Returns:
        A dynamically created Pydantic model.
    """
    
    if fields_json.get("type") == "string":
        fields = {model_name: (str, Field(description=fields_json.get("description", "")))}
        return create_model(model_name, **fields)
    elif fields_json.get("type") == "integer":
        fields = {model_name: (int, Field(description=fields_json.get("description", "")))}
        return create_model(model_name, **fields)
    elif fields_json.get("type") == "number":
        fields = {model_name: (float, Field(description=fields_json.get("description", "")))}
        return create_model(model_name, **fields)
    elif fields_json.get("type") == "boolean":
        fields = {model_name: (bool, Field(description=fields_json.get("description", "")))}
        return create_model(model_name, **fields)
    elif fields_json.get("type") == "array":
        fields = {model_name: (list, Field(description=fields_json.get("description", "")))}
        return create_model(model_name, **fields)
    
    fields = {}
    for field_name, field_info in fields_json.get("properties", fields_json.items()):
        if field_info.get("type") == "object" and "properties" in field_info:
            field_type = create_schema(field_name, field_info)
        else:
            field_type = get_field_type(field_info.get("type", ""))
        
        field_params = {"description": field_info.get("description", "")}
        if field_info.get("required", False):
            field_params["default"] = field_info.get('default', None) or ...
        else:
            field_params["default"] = field_info.get("default", None)
        fields[field_name] = (field_type, Field(**field_params))
    
    return create_model(model_name, **fields)


def json_schema_to_base_model(schema: Dict[str, Any]) -> Type[BaseModel]:
    """
    Convert a JSON schema to a Pydantic BaseModel.
    
    Args:
        schema: The JSON schema dictionary
        
    Returns:
        A dynamically created Pydantic model
    """
    type_mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }

    properties = schema.get("properties", {})
    required_fields = schema.get("required", [])
    model_fields = {}

    for field_name, field_props in properties.items():
        json_type = field_props.get("type", "string")
        enum_values = field_props.get("enum")

        if enum_values:
            enum_name = f"{field_name.capitalize()}Enum"
            field_type = Enum(enum_name, {v: v for v in enum_values})
        else:
            field_type = type_mapping.get(json_type, Any)

        default_value = field_props.get("default", ...)
        nullable = field_props.get("nullable", False)
        description = field_props.get("title", "")

        if nullable:
            field_type = Optional[field_type]

        if field_name not in required_fields:
            default_value = field_props.get("default", None)

        model_fields[field_name] = (field_type, Field(default_value, description=description))

    return create_model(schema.get("title", "DynamicModel"), **model_fields)