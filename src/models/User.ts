import { Schema, model } from "mongoose";

export interface IUser {
	id: number;
	language: string;
	current_thread?: string;
	current_instruction?: string;
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
	current_instruction: {
		type: String,
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
	);
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

export async function updateUser(
	id: number,
	{
		current_thread,
		current_instruction,
	}: {
		current_thread?: string;
		current_instruction?: string;
	}
) {
	const user = await User.findOne({ id });
	if (!user) return null;
	if (current_thread) user.current_thread = current_thread;
	if (current_instruction) user.current_instruction = current_instruction;
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
