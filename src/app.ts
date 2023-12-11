import { start } from "./bot";
import dotenv from "dotenv";
import startMongo from "./utils/start-mongo";
import { initAgents } from "./utils/agents-init";
dotenv.config();
startMongo()
	.then(async () => {
		console.log("MongoDB connected");

		await initAgents();
		console.log("Agents initialized");
		start().catch((err) => {
			console.error(err);
			process.exit(1);
		});
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
