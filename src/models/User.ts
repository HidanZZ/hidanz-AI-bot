import { Schema, model, Types } from "mongoose";
import { MyContext } from "../bot/types";
import { endChat } from "./Chat";

export interface IUser {
	id: number;
	language: string;
	current_thread?: string;
	current_agent?: any;
	chatUsage: number;
	ImageUsage: number;
}

const userSchema = new Schema<IUser>({
	id: {
		type: Number,
		required: true,
	},
	language: {
		type: String,
		required: true,
		default: "en",
	},
	current_thread: {
		type: String,
		default: null,
	},
	current_agent: {
		type: Schema.Types.ObjectId,
		ref: "Agent",
		default: null,
	},
	chatUsage: {
		type: Number,
		default: 0,
	},
	ImageUsage: {
		type: Number,
		default: 0,
	},
});

const User = model<IUser>("User", userSchema);

export function findOrCreateUser(id: number) {
	return User.findOneAndUpdate(
		{ id },
		{},
		{
			upsert: true,
			new: true,
		}
	).populate("current_agent");
}
export function changeLanguage(id: number, language: string) {
	return User.findOneAndUpdate(
		{ id },
		{ language },
		{
			upsert: true,
			new: true,
		}
	);
}
export function getUserById(id: string | Types.ObjectId) {
	return User.findById(id);
}

export async function updateUser(
	id: number,
	{
		current_thread,
		current_agent,
	}: {
		current_thread?: string;
		current_agent?: string;
	}
) {
	const user = await User.findOne({ id });
	if (!user) return null;
	if (current_thread) user.current_thread = current_thread;
	if (current_agent) user.current_agent = current_agent;
	return user.save();
}

export async function resetThread(id: number) {
	return User.findOneAndUpdate(
		{ id },
		{ current_thread: null },
		{
			upsert: true,
			new: true,
		}
	);
}

export async function resetHistory(ctx: MyContext) {
	const user = ctx.session.dbuser;
	if (!user) return;
	await resetThread(user.id);
	//@ts-ignore
	await endChat(user._id);
}

export async function assignInstruction(
	id: number,
	instruction: Types.ObjectId | string
) {
	return User.findOneAndUpdate(
		{ id },
		{ current_agent: instruction },
		{
			upsert: true,
			new: true,
		}
	);
}

export async function incrementUsage(id: number, type: "chat" | "image") {
	const user = await User.findOne({ id });

	if (!user) return null;
	if (type === "chat") user.chatUsage++;
	if (type === "image") user.ImageUsage++;
	return user.save();
}
