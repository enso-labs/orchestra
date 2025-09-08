STREAM_VALUES_MOCK = """data: {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "6fbb5843-a18f-4603-b357-09cba5b8e6e9", "example": false}]}

data: {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "6fbb5843-a18f-4603-b357-09cba5b8e6e9", "example": false}, {"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 87, "prompt_tokens": 145, "total_tokens": 232, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 64, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAimguotYWvVfEyU0idaut1Q9NQAa", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--1c6f493b-0ff1-4131-acc6-1f34991206eb-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 87, "total_tokens": 232, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 64}}}]}

data: {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "6fbb5843-a18f-4603-b357-09cba5b8e6e9", "example": false}, {"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 87, "prompt_tokens": 145, "total_tokens": 232, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 64, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAimguotYWvVfEyU0idaut1Q9NQAa", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--1c6f493b-0ff1-4131-acc6-1f34991206eb-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 87, "total_tokens": 232, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 64}}}, {"content": "The weather in Dallas is perfect for a walk.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "93b22cd5-4cd1-486f-b18f-1be9bfb46f35", "tool_call_id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "artifact": null, "status": "success"}]}

data: {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "6fbb5843-a18f-4603-b357-09cba5b8e6e9", "example": false}, {"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 87, "prompt_tokens": 145, "total_tokens": 232, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 64, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAimguotYWvVfEyU0idaut1Q9NQAa", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--1c6f493b-0ff1-4131-acc6-1f34991206eb-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 87, "total_tokens": 232, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 64}}}, {"content": "The weather in Dallas is perfect for a walk.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "93b22cd5-4cd1-486f-b18f-1be9bfb46f35", "tool_call_id": "call_CwuTl8lGANGtPKvTxwKk2LAH", "artifact": null, "status": "success"}, {"content": "Dallas right now: perfect for a walk.\n\nIf you\u2019d like exact details, I can pull the current temperature, humidity, wind, and an hourly forecast. What details would you like?", "additional_kwargs": {"refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 687, "prompt_tokens": 183, "total_tokens": 870, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 640, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAimiwPh7gVYsixycL0bMcrNUpjVO", "service_tier": "default", "finish_reason": "stop", "logprobs": null}, "type": "ai", "name": null, "id": "run--019f37d7-77ff-47cd-9b3e-10389ad3a30c-0", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 183, "output_tokens": 687, "total_tokens": 870, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 640}}}]}
"""

STREAM_UPDATES_MOCK = """data: [{"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_MbNr9NEF5BpRiEOLU5adL4bC", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 151, "prompt_tokens": 145, "total_tokens": 296, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 128, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj1ynWtvKaLZMZW4oKXGObRa4ygL", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--7444755f-8f4a-4cde-b018-edf5f73e402e-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_MbNr9NEF5BpRiEOLU5adL4bC", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 151, "total_tokens": 296, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 128}}}]

data: [{"content": "Dallas has beautiful weather right now.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "c4601215-b5e2-4675-be5c-e5c2ec13e32f", "tool_call_id": "call_MbNr9NEF5BpRiEOLU5adL4bC", "artifact": null, "status": "success"}]

data: [{"content": "Dallas has beautiful weather right now.\n\nWould you like the current temperature, humidity, wind, and a short forecast for today? I can pull those details if you\u2019d like.", "additional_kwargs": {"refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 364, "prompt_tokens": 180, "total_tokens": 544, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 320, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj20d0SFgrezJBheGCor0oD3Dz4e", "service_tier": "default", "finish_reason": "stop", "logprobs": null}, "type": "ai", "name": null, "id": "run--4356b850-10ae-4363-a4d3-61fd12f51568-0", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 180, "output_tokens": 364, "total_tokens": 544, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 320}}}]
"""

STREAM_DEBUG_MOCK = """data: {"step": 1, "timestamp": "2025-08-31T20:34:22.585863+00:00", "type": "task", "payload": {"id": "13e986df-e8df-7e5e-de75-1b70d73c8ea0", "name": "agent", "input": {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "9b23e827-04b5-4d37-930a-5b1ff3c5b3c9", "example": false}], "remaining_steps": 24}, "triggers": ["branch:to:agent"]}}

data: {"step": 1, "timestamp": "2025-08-31T20:34:24.834566+00:00", "type": "task_result", "payload": {"id": "13e986df-e8df-7e5e-de75-1b70d73c8ea0", "name": "agent", "error": null, "result": [["messages", [{"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_H8DENdpbrbAifVVUgnCjRDMv", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 215, "prompt_tokens": 145, "total_tokens": 360, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 192, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj2kbu0Z5k8T8OkXjHRHewIoO5hG", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--54d8d371-6686-4cc6-acd7-0966a7060a33-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_H8DENdpbrbAifVVUgnCjRDMv", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 215, "total_tokens": 360, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 192}}}]]], "interrupts": []}}

data: {"step": 2, "timestamp": "2025-08-31T20:34:24.835051+00:00", "type": "task", "payload": {"id": "53e86644-18cd-21de-9f20-4fb5de0d7155", "name": "tools", "input": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_H8DENdpbrbAifVVUgnCjRDMv", "type": "tool_call"}], "triggers": ["__pregel_push"]}}

data: {"step": 2, "timestamp": "2025-08-31T20:34:24.837197+00:00", "type": "task_result", "payload": {"id": "53e86644-18cd-21de-9f20-4fb5de0d7155", "name": "tools", "error": null, "result": [["messages", [{"content": "Dallas has beautiful weather right now.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "7352b9d3-8c86-4af1-8445-5df59f60d189", "tool_call_id": "call_H8DENdpbrbAifVVUgnCjRDMv", "artifact": null, "status": "success"}]]], "interrupts": []}}

data: {"step": 3, "timestamp": "2025-08-31T20:34:24.837516+00:00", "type": "task", "payload": {"id": "37bb691d-1548-750c-893f-a4c977f46136", "name": "agent", "input": {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "9b23e827-04b5-4d37-930a-5b1ff3c5b3c9", "example": false}, {"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_H8DENdpbrbAifVVUgnCjRDMv", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 215, "prompt_tokens": 145, "total_tokens": 360, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 192, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj2kbu0Z5k8T8OkXjHRHewIoO5hG", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--54d8d371-6686-4cc6-acd7-0966a7060a33-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_H8DENdpbrbAifVVUgnCjRDMv", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 215, "total_tokens": 360, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 192}}}, {"content": "Dallas has beautiful weather right now.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "7352b9d3-8c86-4af1-8445-5df59f60d189", "tool_call_id": "call_H8DENdpbrbAifVVUgnCjRDMv", "artifact": null, "status": "success"}], "remaining_steps": 22}, "triggers": ["branch:to:agent"]}}

data: {"step": 3, "timestamp": "2025-08-31T20:34:28.171161+00:00", "type": "task_result", "payload": {"id": "37bb691d-1548-750c-893f-a4c977f46136", "name": "agent", "error": null, "result": [["messages", [{"content": "Dallas currently has beautiful weather. Want exact details? I can fetch the current temperature, humidity, wind, and the hourly forecast if you\u2019d like.", "additional_kwargs": {"refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 551, "prompt_tokens": 180, "total_tokens": 731, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 512, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj2mAWAKU53j8QA9W5qb7IDbZaBt", "service_tier": "default", "finish_reason": "stop", "logprobs": null}, "type": "ai", "name": null, "id": "run--fd1e5e7a-72a2-4c68-bf07-289e55c00fb3-0", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 180, "output_tokens": 551, "total_tokens": 731, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 512}}}]]], "interrupts": []}}
"""

STREAM_TASKS_MOCK = """data: {"id": "ec023c7d-8198-6297-aeee-c30666d27bb6", "name": "agent", "input": {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "b7407a82-2889-48ea-9ea6-dfa5a4ddefee", "example": false}], "remaining_steps": 24}, "triggers": ["branch:to:agent"]}

data: {"id": "ec023c7d-8198-6297-aeee-c30666d27bb6", "name": "agent", "error": null, "result": [["messages", [{"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_hybOamZZO3RmrD9YYhEPJw2J", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 151, "prompt_tokens": 145, "total_tokens": 296, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 128, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj3cKV3wd4mb9gEFViQLIs7Xfen5", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--e9791caf-7251-43a4-8c91-1e9d42f82663-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_hybOamZZO3RmrD9YYhEPJw2J", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 151, "total_tokens": 296, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 128}}}]]], "interrupts": []}

data: {"id": "9367ea58-668c-0753-af1b-9df0c4eeddd9", "name": "tools", "input": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_hybOamZZO3RmrD9YYhEPJw2J", "type": "tool_call"}], "triggers": ["__pregel_push"]}

data: {"id": "9367ea58-668c-0753-af1b-9df0c4eeddd9", "name": "tools", "error": null, "result": [["messages", [{"content": "The weather in Dallas is perfect for a walk.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "270a3add-8172-4bbc-a9f3-65a9d71d0ff3", "tool_call_id": "call_hybOamZZO3RmrD9YYhEPJw2J", "artifact": null, "status": "success"}]]], "interrupts": []}

data: {"id": "5443c3a9-89ce-4794-9e3c-522ae592bb9e", "name": "agent", "input": {"messages": [{"content": "Weather in Dallas?", "additional_kwargs": {}, "response_metadata": {}, "type": "human", "name": null, "id": "b7407a82-2889-48ea-9ea6-dfa5a4ddefee", "example": false}, {"content": "", "additional_kwargs": {"tool_calls": [{"id": "call_hybOamZZO3RmrD9YYhEPJw2J", "function": {"arguments": "{\"city\":\"Dallas\"}", "name": "get_weather"}, "type": "function"}], "refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 151, "prompt_tokens": 145, "total_tokens": 296, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 128, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj3cKV3wd4mb9gEFViQLIs7Xfen5", "service_tier": "default", "finish_reason": "tool_calls", "logprobs": null}, "type": "ai", "name": null, "id": "run--e9791caf-7251-43a4-8c91-1e9d42f82663-0", "example": false, "tool_calls": [{"name": "get_weather", "args": {"city": "Dallas"}, "id": "call_hybOamZZO3RmrD9YYhEPJw2J", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 145, "output_tokens": 151, "total_tokens": 296, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 128}}}, {"content": "The weather in Dallas is perfect for a walk.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "270a3add-8172-4bbc-a9f3-65a9d71d0ff3", "tool_call_id": "call_hybOamZZO3RmrD9YYhEPJw2J", "artifact": null, "status": "success"}], "remaining_steps": 22}, "triggers": ["branch:to:agent"]}

data: {"id": "5443c3a9-89ce-4794-9e3c-522ae592bb9e", "name": "agent", "error": null, "result": [["messages", [{"content": "Dallas is currently described as perfect for a walk. Want the exact details (temperature, humidity, wind) or an hourly/daily forecast? Also, please confirm that you mean Dallas, TX.", "additional_kwargs": {"refusal": null}, "response_metadata": {"token_usage": {"completion_tokens": 624, "prompt_tokens": 183, "total_tokens": 807, "completion_tokens_details": {"accepted_prediction_tokens": 0, "audio_tokens": 0, "reasoning_tokens": 576, "rejected_prediction_tokens": 0}, "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0}}, "model_name": "gpt-5-nano-2025-08-07", "system_fingerprint": null, "id": "chatcmpl-CAj3ebCTnkErocJp1VfSNtRIDRFlt", "service_tier": "default", "finish_reason": "stop", "logprobs": null}, "type": "ai", "name": null, "id": "run--e6bd6963-6a08-4b72-9594-115c0662c467-0", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": {"input_tokens": 183, "output_tokens": 624, "total_tokens": 807, "input_token_details": {"audio": 0, "cache_read": 0}, "output_token_details": {"audio": 0, "reasoning": 576}}}]]], "interrupts": []}
"""

STREAM_MESSAGES_MOCK = """data: [{"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": "call_37nosGTDYyZFK4rnBHvVDnKg", "function": {"arguments": "", "name": "get_weather"}, "type": "function"}]}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [{"name": "get_weather", "args": {}, "id": "call_37nosGTDYyZFK4rnBHvVDnKg", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": [{"name": "get_weather", "args": "", "id": "call_37nosGTDYyZFK4rnBHvVDnKg", "index": 0, "type": "tool_call_chunk"}]}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": null, "function": {"arguments": "{\"", "name": null}, "type": null}]}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [{"name": "", "args": {}, "id": null, "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": [{"name": null, "args": "{\"", "id": null, "index": 0, "type": "tool_call_chunk"}]}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": null, "function": {"arguments": "city", "name": null}, "type": null}]}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [], "invalid_tool_calls": [{"name": null, "args": "city", "id": null, "error": null, "type": "invalid_tool_call"}], "usage_metadata": null, "tool_call_chunks": [{"name": null, "args": "city", "id": null, "index": 0, "type": "tool_call_chunk"}]}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": null, "function": {"arguments": "\":\"", "name": null}, "type": null}]}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [], "invalid_tool_calls": [{"name": null, "args": "\":\"", "id": null, "error": null, "type": "invalid_tool_call"}], "usage_metadata": null, "tool_call_chunks": [{"name": null, "args": "\":\"", "id": null, "index": 0, "type": "tool_call_chunk"}]}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": null, "function": {"arguments": "Dallas", "name": null}, "type": null}]}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [], "invalid_tool_calls": [{"name": null, "args": "Dallas", "id": null, "error": null, "type": "invalid_tool_call"}], "usage_metadata": null, "tool_call_chunks": [{"name": null, "args": "Dallas", "id": null, "index": 0, "type": "tool_call_chunk"}]}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": null, "function": {"arguments": "\"}", "name": null}, "type": null}]}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [], "invalid_tool_calls": [{"name": null, "args": "\"}", "id": null, "error": null, "type": "invalid_tool_call"}], "usage_metadata": null, "tool_call_chunks": [{"name": null, "args": "\"}", "id": null, "index": 0, "type": "tool_call_chunk"}]}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {}, "response_metadata": {"finish_reason": "tool_calls", "model_name": "gpt-5-nano-2025-08-07", "service_tier": "default"}, "type": "AIMessageChunk", "name": null, "id": "run--686299fe-5a47-499c-86e5-b37d8aad0acc", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 1, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "checkpoint_ns": "agent:92f5000a-fee8-b6c1-f8f5-658aa7bee9eb", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "The weather in Dallas is perfect for a walk.", "additional_kwargs": {}, "response_metadata": {}, "type": "tool", "name": "get_weather", "id": "a9faca0a-9724-4b4f-9f4b-c2aa4158db74", "tool_call_id": "call_37nosGTDYyZFK4rnBHvVDnKg", "artifact": null, "status": "success"}, {"langgraph_step": 2, "langgraph_node": "tools", "langgraph_triggers": ["__pregel_push"], "langgraph_path": ["__pregel_push", 0, false], "langgraph_checkpoint_ns": "tools:7d260d1e-1ce5-43f4-b98a-b7cc897c9c6f"}]

data: [{"content": "", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "Dallas", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " right", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " now", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": ":", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " the", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " weather", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " is", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " perfect", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " for", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " a", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " walk", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": ".\n\n", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "Would", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " you", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " like", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " more", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " details", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " (", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "temperature", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": ",", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " humidity", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": ",", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " wind", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": ")", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " or", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " a", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " forecast", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " for", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " the", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " next", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " few", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": " days", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "?", "additional_kwargs": {}, "response_metadata": {}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]

data: [{"content": "", "additional_kwargs": {}, "response_metadata": {"finish_reason": "stop", "model_name": "gpt-5-nano-2025-08-07", "service_tier": "default"}, "type": "AIMessageChunk", "name": null, "id": "run--c08b73e1-8a66-40c6-ae58-f861775d1cc5", "example": false, "tool_calls": [], "invalid_tool_calls": [], "usage_metadata": null, "tool_call_chunks": []}, {"langgraph_step": 3, "langgraph_node": "agent", "langgraph_triggers": ["branch:to:agent"], "langgraph_path": ["__pregel_pull", "agent"], "langgraph_checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "checkpoint_ns": "agent:aacf230e-95cb-e5c5-4bb8-9c3207d3110c", "ls_provider": "openai", "ls_model_name": "gpt-5-nano", "ls_model_type": "chat", "ls_temperature": null}]
"""

INVOKE_MOCK = {
    "messages": [
        {
            "content": "Weather in Dallas?",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "human",
            "name": None,
            "id": "bf406e4a-d0f2-42eb-8e1f-89cb7da5f9eb",
            "example": False,
        },
        {
            "content": "",
            "additional_kwargs": {
                "tool_calls": [
                    {
                        "id": "call_Qkx26tP2WH4xu0T11sFdzwTZ",
                        "function": {
                            "arguments": '{"city":"Dallas"}',
                            "name": "get_weather",
                        },
                        "type": "function",
                    }
                ],
                "refusal": None,
            },
            "response_metadata": {
                "token_usage": {
                    "completion_tokens": 87,
                    "prompt_tokens": 145,
                    "total_tokens": 232,
                    "completion_tokens_details": {
                        "accepted_prediction_tokens": 0,
                        "audio_tokens": 0,
                        "reasoning_tokens": 64,
                        "rejected_prediction_tokens": 0,
                    },
                    "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0},
                },
                "model_name": "gpt-5-nano-2025-08-07",
                "system_fingerprint": None,
                "id": "chatcmpl-CAiSezbtcxB6IUbEaO3AOifkTahAL",
                "service_tier": "default",
                "finish_reason": "tool_calls",
                "logprobs": None,
            },
            "type": "ai",
            "name": None,
            "id": "run--57211b72-ae1b-4dfb-9265-f90b99192cd4-0",
            "example": False,
            "tool_calls": [
                {
                    "name": "get_weather",
                    "args": {"city": "Dallas"},
                    "id": "call_Qkx26tP2WH4xu0T11sFdzwTZ",
                    "type": "tool_call",
                }
            ],
            "invalid_tool_calls": [],
            "usage_metadata": {
                "input_tokens": 145,
                "output_tokens": 87,
                "total_tokens": 232,
                "input_token_details": {"audio": 0, "cache_read": 0},
                "output_token_details": {"audio": 0, "reasoning": 64},
            },
        },
        {
            "content": "Expect sunshine and smiles in Dallas.",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "tool",
            "name": "get_weather",
            "id": "0676409e-8b0c-4dfe-849e-ec746845b71a",
            "tool_call_id": "call_Qkx26tP2WH4xu0T11sFdzwTZ",
            "artifact": None,
            "status": "success",
        },
        {
            "content": "",
            "additional_kwargs": {
                "tool_calls": [
                    {
                        "id": "call_5q6HATJ52T4YWfkXyOgeoi1T",
                        "function": {
                            "arguments": '{"city":"Dallas"}',
                            "name": "get_weather",
                        },
                        "type": "function",
                    }
                ],
                "refusal": None,
            },
            "response_metadata": {
                "token_usage": {
                    "completion_tokens": 471,
                    "prompt_tokens": 180,
                    "total_tokens": 651,
                    "completion_tokens_details": {
                        "accepted_prediction_tokens": 0,
                        "audio_tokens": 0,
                        "reasoning_tokens": 448,
                        "rejected_prediction_tokens": 0,
                    },
                    "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0},
                },
                "model_name": "gpt-5-nano-2025-08-07",
                "system_fingerprint": None,
                "id": "chatcmpl-CAiSfo8fEbSPxaA1scfiqViFXXrzD",
                "service_tier": "default",
                "finish_reason": "tool_calls",
                "logprobs": None,
            },
            "type": "ai",
            "name": None,
            "id": "run--4b59d3fa-c0d5-4504-8077-6d20dec8e21c-0",
            "example": False,
            "tool_calls": [
                {
                    "name": "get_weather",
                    "args": {"city": "Dallas"},
                    "id": "call_5q6HATJ52T4YWfkXyOgeoi1T",
                    "type": "tool_call",
                }
            ],
            "invalid_tool_calls": [],
            "usage_metadata": {
                "input_tokens": 180,
                "output_tokens": 471,
                "total_tokens": 651,
                "input_token_details": {"audio": 0, "cache_read": 0},
                "output_token_details": {"audio": 0, "reasoning": 448},
            },
        },
        {
            "content": "It's always sunny in Dallas!",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "tool",
            "name": "get_weather",
            "id": "316e6ece-790b-472d-aeb3-b53501cfcffa",
            "tool_call_id": "call_5q6HATJ52T4YWfkXyOgeoi1T",
            "artifact": None,
            "status": "success",
        },
        {
            "content": "",
            "additional_kwargs": {
                "tool_calls": [
                    {
                        "id": "call_gFc8q0zpvJHLAz8uJFfbMuIm",
                        "function": {
                            "arguments": '{"city":"Dallas"}',
                            "name": "get_weather",
                        },
                        "type": "function",
                    }
                ],
                "refusal": None,
            },
            "response_metadata": {
                "token_usage": {
                    "completion_tokens": 535,
                    "prompt_tokens": 214,
                    "total_tokens": 749,
                    "completion_tokens_details": {
                        "accepted_prediction_tokens": 0,
                        "audio_tokens": 0,
                        "reasoning_tokens": 512,
                        "rejected_prediction_tokens": 0,
                    },
                    "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0},
                },
                "model_name": "gpt-5-nano-2025-08-07",
                "system_fingerprint": None,
                "id": "chatcmpl-CAiSjftCHQ21sHgbmKeWf3tYxCR3k",
                "service_tier": "default",
                "finish_reason": "tool_calls",
                "logprobs": None,
            },
            "type": "ai",
            "name": None,
            "id": "run--6da81f5d-76e7-443c-a0db-1e7e8479ead0-0",
            "example": False,
            "tool_calls": [
                {
                    "name": "get_weather",
                    "args": {"city": "Dallas"},
                    "id": "call_gFc8q0zpvJHLAz8uJFfbMuIm",
                    "type": "tool_call",
                }
            ],
            "invalid_tool_calls": [],
            "usage_metadata": {
                "input_tokens": 214,
                "output_tokens": 535,
                "total_tokens": 749,
                "input_token_details": {"audio": 0, "cache_read": 0},
                "output_token_details": {"audio": 0, "reasoning": 512},
            },
        },
        {
            "content": "Dallas is experiencing clear skies today.",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "tool",
            "name": "get_weather",
            "id": "cbdc0fb3-4f63-4842-9665-4d1ecb5e0b85",
            "tool_call_id": "call_gFc8q0zpvJHLAz8uJFfbMuIm",
            "artifact": None,
            "status": "success",
        },
        {
            "content": "Dallas today: clear skies with plenty of sun. No rain in the forecast.\n\nWould you like the current temperature and hourly forecast? I can pull that up next.",
            "additional_kwargs": {"refusal": None},
            "response_metadata": {
                "token_usage": {
                    "completion_tokens": 810,
                    "prompt_tokens": 249,
                    "total_tokens": 1059,
                    "completion_tokens_details": {
                        "accepted_prediction_tokens": 0,
                        "audio_tokens": 0,
                        "reasoning_tokens": 768,
                        "rejected_prediction_tokens": 0,
                    },
                    "prompt_tokens_details": {"audio_tokens": 0, "cached_tokens": 0},
                },
                "model_name": "gpt-5-nano-2025-08-07",
                "system_fingerprint": None,
                "id": "chatcmpl-CAiSmm46Zzx4gNJB3L5gGY9pSzBWD",
                "service_tier": "default",
                "finish_reason": "stop",
                "logprobs": None,
            },
            "type": "ai",
            "name": None,
            "id": "run--fb3393b4-7dd2-4706-a83b-04f39661adc6-0",
            "example": None,
            "tool_calls": [],
            "invalid_tool_calls": [],
            "usage_metadata": {
                "input_tokens": 249,
                "output_tokens": 810,
                "total_tokens": 1059,
                "input_token_details": {"audio": 0, "cache_read": 0},
                "output_token_details": {"audio": 0, "reasoning": 768},
            },
        },
    ]
}


class MockResponse:
    INVOKE_RESPONSE = {
        "description": "Chat completion response.",
        "content": {
            "application/json": {"example": INVOKE_MOCK},
        },
    }
    STREAM_RESPONSE = {
        "description": "Latest message from existing thread.",
        "content": {
            "text/event-stream": {
                "schema": {"type": "string", "format": "binary"},
                "examples": {
                    "values": {
                        "summary": "stream_mode: values",
                        "value": STREAM_VALUES_MOCK,
                    },
                    "messages": {
                        "summary": "stream_mode: messages",
                        "value": STREAM_MESSAGES_MOCK,
                    },
                    "updates": {
                        "summary": "stream_mode: updates",
                        "value": STREAM_UPDATES_MOCK,
                    },
                    "debug": {
                        "summary": "stream_mode: debug",
                        "value": STREAM_DEBUG_MOCK,
                    },
                    "tasks": {
                        "summary": "stream_mode: tasks",
                        "value": STREAM_TASKS_MOCK,
                    },
                    ## TODO: Did not see a response initially for this
                    # "checkpoints": {
                    #     "summary": "stream_mode: checkpoints",
                    #     "value": STREAM_CHECKPOINTS_MOCK
                    # },
                },
            }
        },
    }
