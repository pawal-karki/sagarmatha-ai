import { inngest } from "./client";
import { Agent, gemini, createAgent } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox } from "./util";

export const sagarmathaAI = inngest.createFunction(
  { id: "sagarmatha-ai" },
  { event: "api/sagarmatha.ai" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("sagarmatha-nextjs-test");
      return sandbox.sandboxId;
    });

    const codeAgent = createAgent({
      name: "code-agent",
      system:
        "You are a helpful assistant for building and debugging modern Next.js applications. Use the latest Next.js standards, focusing on App Router, file-based routing, API routes, and dynamic components. Provide clear, concise guidance and write clean TypeScript code by default. Assist with common issues, performance tips, integrations (like Tailwind or Prisma), and deployment. Always follow best practices and respond accurately based on the user’s context.",
      model: gemini({ model: "gemini-1.5-flash" }),
    });

    const { output } = await codeAgent.run(`Code Snippet: ${event.data.value}`);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });
    return { output, sandboxUrl };
  }
);
