import { MenuTemplate } from "grammy-inline-menu";
import { MyContext } from "../../types";
import { Composer } from "grammy";
import * as language from "./language";
import * as agents from "./agents";

export const bot = new Composer<MyContext>();
export const menu = new MenuTemplate<MyContext>("Settings");
bot.use(agents.bot);
menu.submenu(
	async (ctx) => {
		const local = await ctx.i18n.getLocale();
		return "🌐 Language : " + local;
	},
	"language",
	language.menu
);

menu.submenu("🤖 Agents", "agents", agents.menu);
