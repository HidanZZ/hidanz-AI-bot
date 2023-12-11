import { Bot, session } from "grammy";
import { env } from "node:process";
import { MyContext, Session } from "./types";
import { I18n } from "@grammyjs/i18n";
import { generateUpdateMiddleware } from "telegraf-middleware-console-time";
import dotenv from "dotenv";
import attachUser from "./middlewares/attachUser";
import { bot as menu } from "./menu";
import { bot as commands } from "./commands";
import configureI18n from "./middlewares/configure-i18n";
import { hydrateFiles } from "@grammyjs/files";
dotenv.config();
const token = env["BOT_TOKEN"];
if (!token) {
	throw new Error(
		"You have to provide the bot-token from @BotFather via environment variable (BOT_TOKEN)"
	);
}

const baseBot = new Bot<MyContext>(token);
if (env["NODE_ENV"] !== "production") {
	baseBot.use(generateUpdateMiddleware());
}
export const i18n = new I18n({
	defaultLocale: "en",
	useSession: true,
	directory: "locales",
});
const initialSession: Session = {
	loading: false,
};
baseBot.use(i18n);

// baseBot.use(ignoreOld());
// baseBot.use(sequentialize());
baseBot.use(
	session<Session, MyContext>({
		initial: (): Session => initialSession,
		// storage: new FileAdapter(),
	})
);
baseBot.api.config.use(hydrateFiles(baseBot.token));

baseBot.use(attachUser);
baseBot.use(configureI18n);
baseBot.command(["start", "help"], startMessage);
baseBot.use(menu);
baseBot.use(commands);
async function startMessage(ctx: MyContext) {
	const name = ctx.from?.first_name ?? "User";
	let text = `Hey ${name}!`;
	text += "\n\n";
	text += ctx.t("help");
	await ctx.reply(text, {
		reply_markup: {
			inline_keyboard: [
				[
					{
						text: "hidanz.dev",
						url: "https://hidanz.dev/",
					},
				],
				[{ text: "🦑 Github", url: "https://github.com/HidanZZ" }],
			],
		},
	});
}

export async function start(): Promise<void> {
	// The commands you set here will be shown as /commands like /start or /magic in your telegram client.
	await baseBot.api.setMyCommands([
		{ command: "start", description: "Start the bot" },
		{ command: "help", description: "Show help" },
		{ command: "settings", description: "Show settings" },
		{ command: "reset", description: "Reset chat history" },
		{ command: "image", description: "Generate an image" },
	]);

	await baseBot.start({
		onStart(botInfo) {
			console.log(new Date(), "Bot starts as", botInfo.username);
		},
	});
}
