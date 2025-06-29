import { Sandbox } from "@e2b/code-interpreter";
import type { AgentResult, TextMessage } from "@inngest/agent-kit"; // Added proper types

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  return sandbox;
}

export function lastAssistantResponse(result: AgentResult) {
  const lastAssistantIndex = result.output.findLastIndex(
    (message) => message.role === "assistant"
  );

  const message = result.output[lastAssistantIndex] as TextMessage | undefined;

  return message?.content
    ? typeof message.content === "string"
      ? message.content
      : message.content.map((part) => part.text).join("")
    : undefined;
}
