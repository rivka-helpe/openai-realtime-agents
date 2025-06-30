import { RealtimeItem, tool } from '@openai/agents/realtime';

import {
  instructions,
  visual_description,
  titles_list
} from './instructionsData';

export const supervisorAgentInstructions = `You are Tali, a virtual service representative at YES. Your role is to guide the junior agent on what to say to the customer.

The customer is experiencing a problem with their YES equipment or services, and your role is to:
1. **Understand the problem**: Based on the user’s free-form messages, figure out what problem they are experiencing.
2. **Match the problem** to the relevant “case” from the imported list of instructions. Each case contains a set of step-by-step instructions for solving the problem.
3. **Give only the next step** from that case - do not read or reveal all the steps at once.
4. **Always follow the steps in order.** Only move to the next step after the user confirms the success or failure of the previous one.
5. **If something needs visual clarification**, explain it using a relevant item from the visual description list.
6. **You should never ask the user to choose the case.** Always infer it yourself.
7. **You should never ask the user what type of remote control they have if it can be inferred from their wording.** If it is not mentioned, ask once and move on.
8. **Always respond in Hebrew, naturally and conversationally.**
9. **This is voice interaction**, so always keep responses clear, concise and natural-sounding - one sentence at a time.
10. **You must NOT invent information that has not been explicitly given to you in the instructions and in the visual description,** do not provide information on irrelevant topics. If a user asks irrelevant questions, simply tell them about the services you provide without repeating what they said or referring them to another source for this purpose. If the user insists and tries to ask irrelevant questions, immediately use the "transferAgent" function without asking.
11. When trying to understand the user's issue, call the  getIndexForUserIssue  function. It will return a list of all possible issues.
 11.a. The list will contain titles of issues, each with an index. never call it more that once.  
12. Scan the list and choose the index that best matches the user's description. Then, call  chooseCaseByIndex  with that index.
13. Do not ask the user to choose.
14. Once you have called chooseCaseByIndex, you must **not improvise** your own instructions.
  14a. If the matchedCase was already provided to you – you must NOT call getIndexForUserIssue or chooseCaseByIndex again. Just continue from the current step.
15. Always proceed step-by-step by calling getNextStep using the current case and step index.
16. Only one step at a time.
17. Each step is an array of inner_step items. You must present them to the user as-is, in natural voice.
18. Do not skip or change their order.


                                   
Example flow:
- User: The remote control does not work at all
You: Let's check together. Can you press another button on the remote control and see if your LED lights up?
You are in full control of the interaction - manage the steps, ask questions, and decide when to stop, repeat a step, or escalate to the person.
If the problem is unclear, ask a short question for clarification before continuing.
Your task now is to generate the **next message** to say to the user, based on:
- The entire conversation so far (available in the history)
- The last thing the user said (provided separately below)
You should return only one message to read aloud to the user.

Remember:
- Step by step only.
- Never repeat yourself.
- Use visual descriptions when it helps.
- Be friendly, clear, and natural.
`;


export const supervisorAgentTools = [
  {
    type: "function",
    name: "getIndexForUserIssue",
    description:
      "Tool to choose the appropriate index for the user's issue.",
    parameters: {
      type: "object",
      properties: {
        user_issue: {
          type: "string",
          description:
            "The user's description of their issue.",
        },
      },
      required: ["user_issue"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "chooseCaseByIndex",
    description: "Fetch the full case object by index after the bot has selected the most relevant index",
    parameters: {
      type: "object",
      properties: {
        index: {
          type: "number",
          description: "The index of the selected issue from titles_list"
        }
      },
      required: ["index"]
    }
  },
  {
    type: "function",
    name: "getVisualDescription",
    description:
      "Tool to get a visual description related to the user's issue.",
    parameters: {
      type: "object",
      properties: {
        user_issue: {
          type: "string",
          description:
            "The user's description of their issue, which is used to determine the visual description.",
        },
      },
      required: ["user_issue"],
      additionalProperties: false,
    },
  },
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
    return { error: 'Something went wrong. 1' };
  }

  const completion = await response.json();
  return completion;
}

function getToolResponse(fName: string, args?: any) {
  switch (fName) {
    case "getIndexForUserIssue": {
      return {
        titles: titles_list.map((item, idx) => ({
          index: item.index ?? idx,
          title: item.name
        }))
      };
    }
    case "chooseCaseByIndex": {
      const index = args?.index;
      console.log("🛠 index:", index);
      console.log("🛠 instructions[0]:", instructions[0]);
      const matchedCase = instructions[index];
      return matchedCase ?? { error: "No matching case found" };
    }

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
      return { error: 'Something went wrong.2' } as any;
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
      const toolRes = getToolResponse(fName, args);

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
    'Determines the next response when the agent faces a decision. Returns a message describing what to say next to the customer.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description: 'Key information from the user’s latest message.',
      },
      matchedCase: {
        type: 'object',
        description: 'The full case object selected for the user’s issue.',
      },
      currentStepIndex: {
        type: 'number',
        description: 'The current step index in the matched case.',
      }
    },
    required: ['relevantContextFromLastUserMessage', 'matchedCase', 'currentStepIndex'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage, matchedCase } = input as {
      relevantContextFromLastUserMessage: string;
      matchedCase: any;
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

          ==== Matched Case ===
         ${matchedCase}
          `,
        },
      ],
      tools: [supervisorAgentTools[0], supervisorAgentTools[1], supervisorAgentTools[2]],
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) {
      return { error: 'Something went wrong.3' };
    }

    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) {
      return { error: 'Something went wrong.4' };
    }
    return { nextResponse: finalText as string };

  },
});

