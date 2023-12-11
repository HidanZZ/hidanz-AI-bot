import { Schema, Types, model } from "mongoose";

export interface IAgent {
	name: string;
	instructions: string;
	description: string;
	emoji: string;
}

const agentSchema = new Schema<IAgent>({
	name: {
		type: String,
		required: true,
	},
	instructions: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	emoji: {
		type: String,
		required: true,
	},
});

const Agent = model<IAgent>("Agent", agentSchema);

export async function findOrCreateAgent(
	name: string,
	{
		instructions,
		description,
		emoji,
	}: {
		instructions: string;
		description: string;
		emoji: string;
	}
) {
	return Agent.findOneAndUpdate(
		{ name },
		{ instructions, description, emoji },
		{
			upsert: true,
			new: true,
		}
	);
}

export async function getAllAgents() {
	return Agent.find({});
}

export async function getById(id: string | Types.ObjectId) {
	return Agent.findById(id);
}
