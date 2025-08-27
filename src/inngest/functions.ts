import { inngest } from "./client";
import {
  Agent,
  gemini,
  grok,
  openai,
  createAgent,
  createTool,
  createNetwork,
  type Tool,
} from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";

import { z } from "zod";
import { PROMPT } from "./prompt";
import { getSandbox, lastAssistantResponse } from "./util";
import { prisma } from "@/lib/dbConnection";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const sagarmathaAI = inngest.createFunction(
  { id: "sagarmatha-ai" },
  { event: "api/sagarmatha.ai" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("sagarmatha-nextjs-test");
      return sandbox.sandboxId;
    });

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description:
        "A helpful assistant for building and debugging modern Next.js applications.",
      system: PROMPT,
      model: gemini({
        model: "gemini-2.0-flash-exp",
        // defaultParameters: {
        //   temperature: 0.1,
        // },
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
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
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
      //if the last message of the agent contains the tasksummary keyword it will return the message
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

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) {
          return;
        }
        return codeAgent;
      },
    });

    const result = await network.run(event.data);

    const isError =
      !result.state.data.summary ||
      Object.keys(network.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went Wrong Error Occured",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }
      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: result.state.data.summary,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: "Fragment",
              files: network.state.data.files,
            },
          },
        },
      });
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: network.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
