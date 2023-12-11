import { MenuMiddleware, MenuTemplate } from "grammy-inline-menu";
import { MyContext } from "../../../types";
import { backButtons } from "../../back-buttons";
import { getAllAgents, getById } from "../../../../models/Agent";
import * as confirm from "./confirm";
import { Composer } from "grammy";
import { escapers } from "@telegraf/entity";
import { getUserById } from "../../../../models/User";

export const bot = new Composer<MyContext>();
export const menu = new MenuTemplate<MyContext>(async (ctx: MyContext) => {
	const noAgentMessage =
		"❌ No Active Agent\n\n_Please select an agent below:_";
	const user = ctx.session.dbuser;
	console.log(user);

	if (!user) return "❌ Erroruser";
	//@ts-ignore
	const userdb = await getUserById(user._id);
	if (!userdb) return "❌ Erroruserdb";
	if (!userdb.current_agent)
		return {
			text: noAgentMessage,
			parse_mode: "MarkdownV2",
		};

	const agent = await getById(userdb.current_agent);
	if (!agent)
		return {
			text: noAgentMessage,
			parse_mode: "MarkdownV2",
		};
	const message = `✅ Current Active Agent : \n\n${
		agent.emoji
	} ${escapers.MarkdownV2(agent.name)}\n\n_${escapers.MarkdownV2(
		agent.description
	)}_`;
	return {
		text: message,
		parse_mode: "MarkdownV2",
	};
});
// const confirmMiddleware = new MenuMiddleware("agConfirm/", confirm.menu);
// bot.use(confirmMiddleware);
menu.chooseIntoSubmenu(
	"ag",
	async () => {
		const agentsToShow: Record<string, string> = {};
		const agents = await getAllAgents();
		if (!agents) return agentsToShow;
		agents.forEach((agent) => {
			agentsToShow[agent.id] = agent.emoji + " " + agent.name;
		});
		return agentsToShow;
	},
	confirm.menu,
	{
		columns: 1,
		maxRows: 5,
		getCurrentPage: (context) => context.session.page,
		setPage: (context, page) => {
			context.session.page = page;
		},
	}
);

menu.manualRow(backButtons);
