import OpenAI from "openai";
import { env } from "node:process";
import { IUser, updateUser } from "../models/User";
import dotenv from "dotenv";
import { MyContext } from "../bot/types";
dotenv.config();
import { InputFile } from "grammy";
import {
	base64ToUint8Array,
	downloadAsFileLike,
	removeMarkdownLink,
} from "./file";
import { updateorCreateChat } from "../models/Chat";
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
	userMessage: string,
	file_id?: string,
	instructions?: string
) => {
	try {
		const assistantId = env["ASSISTANT_ID"];
		if (!assistantId) throw new Error("ASSISTANT_ID not found in env");
		// Create a message in the thread with the user's content
		const user_msg = await openai.beta.threads.messages.create(thread_id, {
			role: "user",
			content: userMessage,
			file_ids: file_id ? [file_id] : undefined,
		});

		// Create a run with the assistant
		const myRun = await openai.beta.threads.runs.create(thread_id, {
			assistant_id: assistantId,
			tools: [{ type: "code_interpreter" }, { type: "retrieval" }],
			model: "gpt-3.5-turbo-1106",
			instructions: instructions ?? "You are a helpful assistant",
		});

		// Retrieve the run's result
		await retrieveAndHandleRun(thread_id, myRun.id);
		return user_msg.id;
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
		// console.log(
		// 	"keepRetrievingRun",
		// 	JSON.stringify(keepRetrievingRun, null, 2)
		// );

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

const handleFileUpload = async (file_url: string) => {
	const filelike = await downloadAsFileLike(file_url);

	const file = await openai.files.create({
		file: filelike,
		purpose: "assistants",
	});
	console.log("file", file);

	return file.id;
};

export const handleRetrieveFile = async (file_id: string) => {
	const info = await openai.files.retrieve(file_id);
	const file = await openai.files.content(file_id);

	console.log(file.headers);

	const buffer = new Uint8Array(await file.arrayBuffer());
	console.log("file", file);

	return {
		buffer,
		info,
	};
};
const sendFile = async (file_id: string, ctx: MyContext) => {
	try {
		const { buffer, info } = await handleRetrieveFile(file_id);
		await ctx.replyWithDocument(new InputFile(buffer, info.filename));
	} catch (error) {
		console.log(error);
	}
};
export async function getMessages(thread_id: string) {
	return await openai.beta.threads.messages.list(thread_id);
}

export async function getAIResponse(
	user: IUser & { _id: string },
	message: string,
	ctx: MyContext,
	chat_id: number,
	reply_to_message_id: number,
	file_url?: string
) {
	try {
		const thread_id = await createThreadIfNotExists(
			user.id,
			user.current_thread
		);
		ctx.session.loading = true;
		const file_id = file_url ? await handleFileUpload(file_url) : undefined;
		const user_msg_id = await processAssistantMessage(
			thread_id,
			message,
			file_id,
			user.current_agent?.instructions
		);

		const allMessages = await openai.beta.threads.messages.list(thread_id);
		const messages_after = await openai.beta.threads.messages.list(thread_id, {
			before: user_msg_id,
		});
		console.log("messages_after", JSON.stringify(messages_after, null, 2));

		// console.log("allMessages", JSON.stringify(allMessages, null, 2));

		const messages = allMessages.data.map((message) => ({
			role: message.role,
			// @ts-ignore
			content: message.content[0].text.value,
			file: message.file_ids ? message.file_ids[0] : undefined,
		}));
		const messages_after_user = messages_after.data
			.map((message) => ({
				role: message.role,
				// @ts-ignore
				content: message.content[0].text.value,
				file_id:
					// @ts-ignore
					message.content[0].text.annotations.length > 0
						? // @ts-ignore
						  message.content[0].text.annotations[0].type === "file_path"
							? // @ts-ignore
							  message.content[0].text.annotations[0].file_path.file_id
							: undefined
						: undefined,
				url:
					// @ts-ignore
					message.content[0].text.annotations.length > 0
						? // @ts-ignore
						  message.content[0].text.annotations[0].type === "file_path"
							? // @ts-ignore
							  message.content[0].text.annotations[0].text
							: undefined
						: undefined,
			}))
			.reverse();
		await updateorCreateChat(user._id, {
			messages,
			thread_id,
		});

		ctx.session.loading = false;

		await ctx.api.deleteMessage(chat_id, reply_to_message_id);
		//loop through messages and send them
		for (const message of messages_after_user) {
			if (message.file_id !== undefined && message.url !== null) {
				const newMessage = removeMarkdownLink(message.content, message.url);
				await ctx.reply(newMessage, {
					parse_mode: "Markdown",
				});
				await sendFile(message.file_id, ctx);
			} else {
				await ctx.reply(message.content, {
					parse_mode: "Markdown",
				});
			}
		}
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
