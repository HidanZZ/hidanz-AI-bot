import { Composer } from "grammy";
import { MyContext } from "./types";
import { incrementUsage, resetHistory, resetThread } from "../models/User";
import {
	getAIResponse,
	getImageGeneration,
	getMessages,
	handleRetrieveFile,
} from "../utils/ai";
import { endChat } from "../models/Chat";
import { InputFile } from "grammy";

export const bot = new Composer<MyContext>();

bot.command("reset", async (ctx) => {
	try {
		await resetHistory(ctx);
		await ctx.reply(ctx.t("reset_success"));
	} catch (error) {
		console.log(error);
		await ctx.reply(ctx.t("reset_error"));
	}
});

bot.command("image", async (ctx) => {
	const user = ctx.session.dbuser;
	if (!user) return;
	const message = ctx.match;
	if (!message || message.trim().length == 0) return;
	//check usage
	if (user.ImageUsage >= 3) {
		await ctx.reply(ctx.t("usage_error"));
		return;
	}
	const reply_msg = await ctx.reply("...");
	await getImageGeneration(message, ctx, ctx.chat.id, reply_msg.message_id);
	await incrementUsage(user.id, "image");
});

bot.on("message", async (ctx) => {
	console.log("loading", ctx.session.loading);

	if (ctx.session.loading) return;
	const user = ctx.session.dbuser;
	if (!user) return;
	const message = ctx.message;
	if (!message) return;
	if (user.chatUsage >= 3) {
		await ctx.reply(ctx.t("usage_error"));
		return;
	}
	if (message.document) {
		await handleDocument(ctx, user);
		await incrementUsage(user.id, "chat");

		return;
	}
	if (message.text) {
		await handleText(ctx, user);
		await incrementUsage(user.id, "chat");

		return;
	}

	// if (!message) return;
	// if (message.startsWith("/")) return;
	// const reply_msg = await ctx.reply("...");
	// getAIResponse(user, message, ctx, ctx.chat.id, reply_msg.message_id);
});

const handleDocument = async (ctx: MyContext, user: any) => {
	const chat = ctx.chat!;
	if (ctx.message?.media_group_id) {
		await ctx.reply(ctx.t("media_group_error"));
		return;
	}
	if (!ctx.message?.caption || ctx.message?.caption.trim().length == 0) {
		await ctx.reply(ctx.t("caption_error"));
		return;
	}
	const prompt = ctx.message.caption;
	const document = await ctx.getFile();
	//@ts-ignore
	const doc_url = document.getUrl();
	const reply_msg = await ctx.reply("...");
	getAIResponse(user, prompt, ctx, chat.id, reply_msg.message_id, doc_url);
};

const handleText = async (ctx: MyContext, user: any) => {
	const text = ctx.message?.text;
	const chat = ctx.chat!;
	if (!text) return;
	if (text.startsWith("/")) return;
	const reply_msg = await ctx.reply("...");
	getAIResponse(user, text, ctx, chat.id, reply_msg.message_id);
};
