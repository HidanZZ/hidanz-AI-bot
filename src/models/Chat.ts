import { Schema, model, Types } from "mongoose";

export interface IChat {
	user: Types.ObjectId;
	messages: IMessage[];
	thread_id: string;
	ended: boolean;
}

export interface IMessage {
	role: string;
	content: string;
	file?: string;
}

const messageSchema = new Schema<IMessage>({
	role: {
		type: String,
		required: true,
	},
	content: {
		type: String,
		required: true,
	},
	file: {
		type: String,
	},
});

const chatSchema = new Schema<IChat>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		messages: [messageSchema],
		thread_id: {
			type: String,
			required: true,
			unique: true,
		},
		ended: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

const Chat = model<IChat>("Chat", chatSchema);

export function updateorCreateChat(
	user: string | Types.ObjectId,
	{
		messages,
		thread_id,
	}: {
		messages: IMessage[];
		thread_id: string;
	}
) {
	return Chat.findOneAndUpdate(
		{
			user,
			thread_id,
		},
		{
			messages,
		},
		{
			new: true,
			upsert: true,
		}
	);
}

export function endChat(user: string | Types.ObjectId) {
	return Chat.findOneAndUpdate(
		{
			user,
		},
		{
			ended: true,
		},
		{
			new: true,
		}
	);
}
