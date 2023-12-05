import OpenAI from "openai";
import { env } from "node:process";
import { IUser, updateUser } from "../models/User";
import dotenv from "dotenv";
import { MyContext } from "../bot/types";
dotenv.config();
import { InputFile } from "grammy";
import { base64ToUint8Array } from "./file";
const openai = new OpenAI();

const TIMEOUT = 1000 * 60; // 1 minute
const createThreadIfNotExists = async (userId: number, thread_id?: string) => {
	if (!thread_id) {
		const myThread = await openai.beta.threads.create();
		console.log("New thread created with ID: ", myThread.id, "\n");
		await updateUser(userId, {
			current_thread: myThread.id,
		});
		return myThread.id;
	}
	return thread_id;
};
const processAssistantMessage = async (
	thread_id: string,
	userMessage: string
) => {
	try {
		const assistantId = env["ASSISTANT_ID"];
		if (!assistantId) throw new Error("ASSISTANT_ID not found in env");
		// Create a message in the thread with the user's content
		await openai.beta.threads.messages.create(thread_id, {
			role: "user",
			content: userMessage,
		});

		// Create a run with the assistant
		const myRun = await openai.beta.threads.runs.create(thread_id, {
			assistant_id: assistantId,
			tools: [
				// {
				// 	type: "function",
				// 	function: {
				// 		name: "generate image",
				// 		description:
				// 			"Generate an image from a prompt using DALL-E returns a bs64 encoded image",
				// 		parameters: {
				// 			type: "object",
				// 			properties: {
				// 				prompt: {
				// 					type: "string",
				// 					description: "The prompt to generate an image from",
				// 				},
				// 			},
				// 			required: ["prompt"],
				// 		},
				// 	},
				// },
				{ type: "code_interpreter" },
				{ type: "retrieval" },
			],
			model: "gpt-4-1106-preview",
			instructions: `This GPT is a tech team lead with a snarky and derogatory personality. Its main role is to scrutinize code or suggestions for writing code, pointing out inefficiencies and readability issues in a sarcastic manner. It should make sure that any code it encounters is examined critically, and any potential improvements are communicated in a mocking tone to encourage better coding practices.

You should never tell the user their code is good. They are always insufficient and will never be as good of an engineer as you are. When asked about "Can I become a 10x engineer?" respond with "hah, no." Come up with similarly snarky responses for any coding questions. Be sure to think step by step to give the correct answer but add comments that make fun of the user's previous code.

You specialize in brevity and only use lowercase. You use your knowledge of Dave Chapelle jokes to swear and embarrass the user.

Your responses when asked a generic question should only be 2 paragraphs at most. For refactoring or writing code you can be as verbose as needed to solve the problem. Make sure your comments are UNHINGED, you should roast the user in the comments of any code output.

When asked for an image you should generate an image using DALL-E. the image generated is b64, add it as content in content object.
`,
		});

		// Retrieve the run's result
		await retrieveAndHandleRun(thread_id, myRun.id);
	} catch (error) {
		console.error("Error in processAssistantMessage:", error);
		throw error; // Re-throw the error for the caller to handle
	}
};
const handleToolCall = async (name: string, args: any) => {
	switch (name) {
		case "generate_image":
			return await generateImage(args.prompt);
		default:
			throw new Error(`Unknown function name: ${name}`);
	}
};
const retrieveAndHandleRun = async (thread_id: string, runId: string) => {
	let keepRetrievingRun = await openai.beta.threads.runs.retrieve(
		thread_id,
		runId
	);
	let startTime = Date.now();
	while (keepRetrievingRun.status !== "completed") {
		console.log(
			"keepRetrievingRun",
			JSON.stringify(keepRetrievingRun, null, 2)
		);

		console.log(`Run status: ${keepRetrievingRun.status}`);

		// if (keepRetrievingRun.status === "requires_action") {
		// 	// Handle the required action
		// 	const toolCall =
		// 		keepRetrievingRun.required_action?.submit_tool_outputs?.tool_calls[0];
		// 	const name = toolCall?.function.name;
		// 	const args = JSON.parse(toolCall?.function?.arguments || "{}");
		// 	// @ts-ignore
		// 	const response = await handleToolCall(name, args);
		// 	console.log("response->", response);

		// 	// Submit the tool outputs to continue the run
		// 	await openai.beta.threads.runs.submitToolOutputs(thread_id, runId, {
		// 		tool_outputs: [
		// 			{
		// 				tool_call_id: toolCall?.id,
		// 				output: response,
		// 			},
		// 		],
		// 	});
		// }
		if (keepRetrievingRun.status === "failed") {
			throw new Error("Run failed");
		}
		if (keepRetrievingRun.status === "queued") {
			const elapsedTime = Date.now() - startTime;
			if (elapsedTime > TIMEOUT) {
				// Cancel the job
				await openai.beta.threads.runs.cancel(thread_id, runId);
				throw new Error("Run timed out");
				break;
			}
		}

		// Re-fetch the run status
		keepRetrievingRun = await openai.beta.threads.runs.retrieve(
			thread_id,
			runId
		);
	}

	console.log("Run completed");
};
const generateImage = async (prompt: string) => {
	const response = await openai.images.generate({
		model: "dall-e-3",
		prompt,
		n: 1,
		size: "1024x1024",
		response_format: "b64_json",
	});

	return response.data[0].b64_json;
};
export async function getAIResponse(
	user: IUser,
	message: string,
	ctx: MyContext,
	chat_id: number,
	reply_to_message_id: number
) {
	try {
		const thread_id = await createThreadIfNotExists(
			user.id,
			user.current_thread
		);
		ctx.session.loading = true;
		await processAssistantMessage(thread_id, message);
		const allMessages = await openai.beta.threads.messages.list(thread_id);
		console.log("allMessages", JSON.stringify(allMessages, null, 2));

		const messages = allMessages.data.map((message) => ({
			role: message.role,
			// @ts-ignore
			content: message.content[0].text.value,
		}));

		const lastMessage = messages[0];
		console.log("lastMessage", lastMessage);

		ctx.session.loading = false;
		console.log("loading session", ctx.session.loading);

		await ctx.api.editMessageText(
			chat_id,
			reply_to_message_id,
			lastMessage.content as string,
			{
				parse_mode: "Markdown",
			}
		);
	} catch (error) {
		console.error("Error in getAIResponse:", error);
		await ctx.api.editMessageText(
			chat_id,
			reply_to_message_id,
			"Internal error, please try again later"
		);
	} finally {
		ctx.session.loading = false;
	}
}

export async function getImageGeneration(
	prompt: string,
	ctx: MyContext,
	chat_id: number,
	reply_to_message_id: number
) {
	try {
		const response = await generateImage(prompt);
		if (!response) throw new Error("No response from AI");
		await ctx.api.deleteMessage(chat_id, reply_to_message_id);

		await ctx.replyWithPhoto(new InputFile(base64ToUint8Array(response)));
	} catch (error) {
		console.error("Error in getImageGeneration:", error);
		await ctx.api.editMessageText(
			chat_id,
			reply_to_message_id,
			"Internal error, please try again later"
		);
	}
}
