
export function truncateFrom(
  input: string,
  position: "start" | "end" | "middle",
  replacement: string,
  len: number
): string {
  if (input.length <= len) return input;

  const replacementLength = replacement.length;

  // Adjust length for the replacement text
  const allowedLength = len - replacementLength;

  if (allowedLength <= 0) {
    throw new Error("Replacement text is too long for the desired length.");
  }

  let startSliceEnd: number;
  let endSliceStart: number;

  switch (position) {
    case "start":
      startSliceEnd = 0;
      endSliceStart = input.length - allowedLength;
      break;
    case "end":
      startSliceEnd = allowedLength;
      endSliceStart = input.length;
      break;
    case "middle":
      const half = Math.floor(allowedLength / 2);
      startSliceEnd = half;
      endSliceStart = input.length - (allowedLength - half);
      break;
    default:
      throw new Error("Invalid position. Use 'start', 'end', or 'middle'.");
  }

  // Create the truncated string
  return (
    input.slice(0, startSliceEnd) + replacement + input.slice(endSliceStart)
  );
}

interface Message {
  id: string;
  type: string;
  name?: string | null;
  args?: any;
  content?: any;
  output?: any;
  additional_kwargs?: any;
  response_metadata?: any;
  tool_call_id?: string;
  // sometimes tool calls appear as an array inside an ai message:
  tool_calls?: any[];
  [key: string]: any;
}

export function findToolCall(message: any, messages: any[]) {
  for (const msg of messages) {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCalls = msg.tool_calls;

      if (Array.isArray(toolCalls)) {
        // tool_calls is an array: iterate through each call
        for (const call of toolCalls) {
          if (call && typeof call === 'object' && call.id === message.id) {
            delete message.tool_call_id;
            message.args = JSON.stringify(call.args)
            return message;
          }
        }
      } else if (typeof toolCalls === 'object') {
        // tool_calls is a single object
        if (toolCalls.tool_call_id === message.id) {
          return toolCalls;
        }
      }
    }
  }
  return null;
}


/**
 * Combines a tool call (the “input”) with its corresponding tool message (the “output”)
 * by matching the tool call’s id to the tool message’s tool_call_id.
 * Other messages (system, human, ai) are returned untouched.
 */
export function combineToolMessages(messages: Message[]): Message[] {
  // First, build a mapping of tool output messages (“tool–chunk”) keyed by tool_call_id.
  const toolChunksById: Record<string, Message> = {};
  for (const msg of messages) {
    if (msg.type === "tool" && msg.tool_call_id) {
      toolChunksById[msg.tool_call_id] = msg;
    }
  }

  const result: Message[] = [];
  
  // Iterate through the original messages.
  for (const msg of messages) {
    // Leave system, human and ai messages AS-IS.
    if (["system", "human", "ai"].includes(msg.type)) {
      result.push(msg);
      
      // If an ai message “issued” a tool call (often stored in a tool_calls array)
      // then for each such tool call create a combined message.
      if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
        for (const toolCall of msg.tool_calls) {
          // Determine the “input” string.
          // (Often the call contains the command in one of two places.)
          let input = "";
          if (toolCall.args && toolCall.args.commands) {
            if (Array.isArray(toolCall.args.commands)) {
              input = toolCall.args.commands.join(" ");
            } else {
              input = toolCall.args.commands;
            }
          } else if (toolCall.function && toolCall.function.arguments) {
            // Sometimes the arguments are stored as a JSON string.
            try {
              const parsed = JSON.parse(toolCall.function.arguments);
              if (parsed.commands) {
                input = Array.isArray(parsed.commands)
                  ? parsed.commands.join(" ")
                  : parsed.commands;
              }
            } catch (err) {
              // Fallback if parsing fails:
              input = toolCall.function.arguments;
            }
          }
          
          // Look up the corresponding tool output (“tool–chunk”) using the tool call id.
          const toolChunk = toolChunksById[toolCall.id];
          // If there is no output (or it’s falsy), mark status as error.
          // const status = output ? (toolChunk.status || "success") : "error";

          // Build a combined message.
          const combinedMessage = {
            ...toolChunk,
            ...toolCall,
            id: toolCall.id,
            type: "tool" // Add required type property
          };
          result.push(combinedMessage);
        }
      }
    } else if (msg.type === "tool") {
      // If a tool message was not combined (because it wasn't paired with a tool call)
      // then you might choose to push it as–is. (Here we ignore it since we already merged it above.)
      // If you want to include it when there’s no matching tool call, uncomment below:
      //
      // if (!msg.tool_call_id || !toolChunksById[msg.tool_call_id]) {
      //   result.push(msg);
      // }
    }
  }

  return result;
}

export function handleStreamChunk(data: any) {
  // Tool Calls
  if (data.msg.type === 'AIMessageChunk' && data.msg.tool_calls.length > 0) {
    const toolCallData = {
      content: data.msg.content || data.msg,
      type: 'tool',
      name: data.msg.name || data.msg[0].name,
      status: 'pending',
      tool_call_id: data.msg.id,
      id: data.msg.id
    };
    return toolCallData;
  }
  // Tool Chunk
  if (data.msg.type === 'tool') {
    const toolChunkData = {
        content: data.msg.content || data.msg,
        type: 'tool',
        name: data.msg.name,
        status: 'success',
        tool_call_id: data.msg.id,
        isOutput: true
    };
    return toolChunkData;
  }
  if (data.event === 'end') {
    return data.msg;
  }
}


export function constructSystemPrompt(systemPrompt: string) {
        return `${systemPrompt}
---
Current Date and Time: ${new Date().toLocaleString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Language: ${navigator.language}
`;
    }