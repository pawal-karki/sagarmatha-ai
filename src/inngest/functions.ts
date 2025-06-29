import { inngest } from "./client";
import {
  Agent,
  gemini,
  openai,
  createAgent,
  createTool,
  createNetwork,
} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox } from "./util";
import { z } from "zod";
import { PROMPT } from "./prompt";
import { lastAssistantResponse } from "./util";
import { grok } from "inngest";

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
      description:
        "A helpful assistant for building and debugging modern Next.js applications.",
      system: PROMPT,
      model: grok({
        model: "gpt-4o-mini",
        defaultParameters: {
          temperature: 0.1,
        },
      }),

      tools: [
        createTool({
          name: "terminal",
          description: "Use this tool to run terminal commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };
              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  },
                });
                return result.stdout;
              } catch (error) {
                console.error(
                  `Command Failed ${error} \n ${buffers.stdout} \nstderror ${buffers.stderr}`
                );
                return `Command Failed ${error} \n ${buffers.stdout} \nstderror ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "CreateOrUpdateFile",
          description:
            "Use this tool to create or update a file in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async ({ files }, { step, network }) => {
            const newFiles = await step?.run(
              "create-or-update-files",
              async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sandbox = await getSandbox(sandboxId);
                  for (const file of files) {
                    {
                      await sandbox.files.write(file.path, file.content);
                      updatedFiles[file.path] = file.content;
                    }
                  }
                  return updatedFiles;
                } catch (error) {
                  console.error(`Error creating or updating files ${error}`);
                  return network.state.data.files;
                }
              }
            );
            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
            return newFiles;
          },
        }),
        createTool({
          name: "readFiles",
          description: "Use this tool to read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const readFiles = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  readFiles.push({ path: file, content });
                }
                return JSON.stringify(readFiles);
              } catch (error) {
                console.error(`Error reading files ${error}`);
                return [];
              }
            });
          },
        }),
      ],
      //lifecycle
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = lastAssistantResponse(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 10,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) {
          return;
        }
        return codeAgent;
      },
    });

    const result = await network.run(event.data.value);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    return {
      url: sandboxUrl,
      title: "Fragement",
      files: network.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
