import { Composer } from "grammy";
import { MyContext } from "./types";
import { resetThread } from "../models/User";
import { getImageGeneration } from "../utils/ai";

export const bot = new Composer<MyContext>();

bot.command("reset", async (ctx) => {
	try {
		const user = ctx.session.dbuser;
		if (!user) return;
		await resetThread(user.id);
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
	const reply_msg = await ctx.reply("...");
	getImageGeneration(message, ctx, ctx.chat.id, reply_msg.message_id);
});
