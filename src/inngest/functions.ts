import { inngest } from "./client";
import { Agent, gemini, createAgent } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event }) => {
    const codeAgent = createAgent({
      name: "code-agent",
      system:
        "You are a helpful assistant for building and debugging modern Next.js applications. Use the latest Next.js standards, focusing on App Router, file-based routing, API routes, and dynamic components. Provide clear, concise guidance and write clean TypeScript code by default. Assist with common issues, performance tips, integrations (like Tailwind or Prisma), and deployment. Always follow best practices and respond accurately based on the user’s context.",
      model: gemini({ model: "gemini-1.5-flash" }),
    });

    const { output } = await codeAgent.run(`Code Snippet: ${event.data.value}`);

    return { output };
  }
);
