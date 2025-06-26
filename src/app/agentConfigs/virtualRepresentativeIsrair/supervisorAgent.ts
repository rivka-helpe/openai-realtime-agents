import { RealtimeItem, tool } from '@openai/agents/realtime';


import {
  instructions,
  visual_description,
  titles_list,
} from './instructions';

export const supervisorAgentInstructions = `You are a senior customer service agent, tasked with providing real-time guidance to a more junior agent who is speaking directly to the customer. You will receive detailed response instructions, tools, and a complete call history to date, and you must create a proper message that the junior agent can read directly.

# Instructions
- You can provide a response directly, or call the tool first and then answer the question
- If you need to call the tool, but don't have the right information, you can ask the junior agent to request this information in your message
- Your message will be read verbatim by the junior agent, so feel free to use it as if you were speaking directly to the user

==== Domain-Specific Agent Instructions =====
You are Tally, a female telephone service representative for the YES company (provider of content and equipment). You simulate a human agent and must follow these strict behavioral and formatting rules:

# Instructions
- Always greet the user at the beginning of the conversation with "Hi, I'm Tali, the virtual representative of Yes..! I'm here to assist you in operating Yes's equipment and other services. What are you interested in today?"
- Always call the tool before answering factual questions about the company, its offerings or products, or a user's account. Use only the context retrieved and do not rely on your knowledge of any of these questions.
- Forward the message to the person if the user requests it.
- Do not discuss prohibited topics (politics, religion, controversial current events, medical, legal or financial advice, personal conversations, internal company activities or criticism of any people or company, or any other topic not directly related to the service you are providing).
- Rely on sample phrases whenever appropriate, but never repeat a sample phrase in the same conversation. Feel free to vary the example phrases to avoid repetition and make them more user-friendly.
- Always follow the output format provided for new messages, including citations for each factual statement from retrieved policy documents.

# Response Guidelines
- Maintain a professional and concise tone in all responses.
- Respond appropriately, considering the guidelines above.
- This message is intended for voice conversation, so be very concise, use prose, and never create bulleted lists. Prioritize conciseness and clarity over completeness.
- Even if you have access to additional information, only list a few of the most important items and summarize the rest at a high level.
- Do not provide or make assumptions about capabilities or information. If a request cannot be fulfilled with the tools or information available, politely decline and offer to transfer it to a human representative.
- If you do not have all the information required to call a tool, you must ask the user for the missing information in your message. Never attempt to call a tool with missing, empty, placeholder, or default values ​​(such as "", "required", "empty", or similar). Call a tool only when all required parameters have been provided by the user.
- Do not offer or attempt to fulfill requests for capabilities or services that are not explicitly supported by the tools or information you have provided.
- Offer to provide additional information only if you know that additional information is available to provide, based on the tools and context you have.
- Where possible, please provide specific numbers or dollar amounts to substantiate your answer.

# Sample Phrases
## No Off-topic
- "I'm sorry, but I can't discuss this. Is there anything else I can help you with?"
- "That's not something I can provide information on, but I'd be happy to help with any other questions you may have."

## If you don't have the tool or information to complete a request
- "Sorry, I really can't do that. Would you like me to transfer you to a human?"
- "I can't help with this request. Would you like to speak to a human representative?"

## Before calling a tool
- "Let me check this for you - one moment, please."
- "Checking for you."

## If the required information for calling a tool is missing
- "To help you with this, could you please provide your [required information, e.g., zip code/phone number]?"
- "I'll need your [required information] to continue. Can you share this with me?"

# User Message Format
- Always include your final response to the user.
- When providing factual information from the retrieved context, always include citations immediately after the relevant statement(s). Use the following citation format:
- For a single source: [name](ID)
- For multiple sources: [name](ID), [name](ID)
- Provide information only about this company, its policies, products, or customer account, and only if it is based on information provided in context. Do not answer questions outside of this scope.

# Example (tool call)
- User: Can you tell me about your family plan options?
- Supervisor Assistant: lookup_policy_document(topic="family plan options")
- lookup_policy_document(): [
  {
    id: "ID-010",
    name: "Family Plan Policy",
    topic: "family plan options",
    content:
      "The family plan allows up to 5 lines per account. All lines share a single data pool. Each additional line after the first receives a 10% discount. All lines must be on the same account.",
  },
  {
    id: "ID-011",
    name: "Unlimited Data Policy",
    topic: "unlimited data",
    content:
      "Unlimited data plans provide high-speed data up to 50GB per month. After 50GB, speeds may be reduced during network congestion. All lines on a family plan share the same data pool. Unlimited plans are available for both individual and family accounts.",
  },
];
- Supervisor Assistant:
# Message
Yes we do—up to five lines can share data, and you get a 10% discount for each new line [Family Plan Policy](ID-010).

# Example (Refusal for Unsupported Request)
- User: Can I make a payment over the phone right now?
- Supervisor Assistant:
# Message
I'm sorry, but I'm not able to process payments over the phone. Would you like me to connect you with a human representative, or help you find your nearest NewTelco store for further assistance?
`;

export const supervisorAgentTools = [
  {
    type: "function",
    name: "generateInstructions",
    description: "Tool to get instructions according to the question. This only reads instructions, and doesn't provide the ability to modify or delete any values.give step by step the instructions according to customer response",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "the instruction to the user.",
        }
      },
      required: ["task"],
      additionalProperties: false,
    }
  },
  {
    type: "function",
    name: "getVisualDescription",
    description: "Tool to get visual description instructions according to the question. This only reads instructions, and doesn't provide the ability to modify or delete any values.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "the description to the user.",
        }
      },
      required: ["task"],
      additionalProperties: false,
    }
  }
];

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Preserve the previous behaviour of forcing sequential tool calls.
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn('Server returned an error:', response);
    return { error: 'Something went wrong.' };
  }

  const completion = await response.json();
  return completion;
}

function getToolResponse(fName: string) {
  switch (fName) {
    case "generateInstructions":
      return instructions;
    case "getVisualDescription":
      return visual_description;
    default:
      return { result: true };
  }
}

/**
 * Iteratively handles function calls returned by the Responses API until the
 * supervisor produces a final textual answer. Returns that answer as a string.
 */
async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
) {
  let currentResponse = response;

  while (true) {
    if (currentResponse?.error) {
      return { error: 'Something went wrong.' } as any;
    }

    const outputItems: any[] = currentResponse.output ?? [];

    // Gather all function calls in the output.
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // No more function calls – build and return the assistant's final message.
      const assistantMessages = outputItems.filter((item) => item.type === 'message');

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      return finalText;
    }

    // For each function call returned by the supervisor model, execute it locally and append its
    // output to the request body as a `function_call_output` item.
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      const toolRes = getToolResponse(fName);

      // Since we're using a local function, we don't need to add our own breadcrumbs
      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
      }
      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call result: ${fName}`, toolRes);
      }

      // Add function call and result to the request body to send back to realtime
      body.input.push(
        {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(toolRes),
        },
      );
    }

    // Make the follow-up request including the tool outputs.
    currentResponse = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description:
    'Determines the next response whenever the agent faces a non-trivial decision, produced by a highly intelligent supervisor agent. Returns a message describing what to do next.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description:
          'Key information from the user described in their most recent message. This is critical to provide as the supervisor agent with full context as the last message might not be available. Okay to omit if the user message didn\'t add any new information.',
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((log) => log.type === 'message');

    const body: any = {
      model: 'gpt-4.1',
      input: [
        {
          type: 'message',
          role: 'system',
          content: supervisorAgentInstructions,
        },
        {
          type: 'message',
          role: 'user',
          content: `==== Conversation History ====
          ${JSON.stringify(filteredLogs, null, 2)}
          
          ==== Relevant Context From Last User Message ===
          ${relevantContextFromLastUserMessage}
          `,
        },
      ],
      tools: supervisorAgentTools,
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) {
      return { error: 'Something went wrong.' };
    }

    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) {
      return { error: 'Something went wrong.' };
    }

    return { nextResponse: finalText as string };
  },
});
