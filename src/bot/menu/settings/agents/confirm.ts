import { MenuTemplate } from "grammy-inline-menu";
import { MyContext } from "../../../types";
import { backButtons } from "../../back-buttons";
import { getById } from "../../../../models/Agent";
import { escapers } from "@telegraf/entity";
import { assignInstruction, resetHistory } from "../../../../models/User";

export const menu = new MenuTemplate<MyContext>(async (ctx) => {
	const id = ctx.match && ctx.match[1];
	if (!id) return "❌ Error";
	const agent = await getById(id);
	const message = `${agent?.emoji} ${escapers.MarkdownV2(
		agent?.name ?? ""
	)}\n\n_${escapers.MarkdownV2(
		agent?.description ?? ""
	)}_\n\n*By selecting this agent , your chat history will be reset \\!\\!*`;
	return {
		text: message,
		parse_mode: "MarkdownV2",
	};
});
const options: Record<string, string> = {
	yes: "✅ Yes",
	no: "❌ No",
};
menu.choose("confirmag", options, {
	do: async (ctx, key) => {
		try {
			const id = ctx.match && ctx.match[1];
			if (!id) return "..";

			console.log(key);
			if (key === "no") return "..";
			const user = ctx.session.dbuser;
			if (!user) return "..";
			await assignInstruction(user.id, id);
			await resetHistory(ctx);

			return "..";
		} catch (error) {
			console.log(error);
			return "..";
		}
	},
});

menu.manualRow(backButtons);
