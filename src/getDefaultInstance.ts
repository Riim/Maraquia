import * as fs from 'fs';
import { MongoClient } from 'mongodb';
import * as path from 'path';
import { Maraquia } from './Maraquia';

let defaultInstance: Maraquia | undefined;

export async function getDefaultInstance(): Promise<Maraquia> {
	if (defaultInstance) {
		return defaultInstance;
	}

	let configPath = path.join(process.cwd(), 'config/maraquia.json');
	let config: {
		databaseUrl: string;
		databaseName: string;
	} = fs.existsSync(configPath)
		? JSON.parse(fs.readFileSync(configPath, 'utf8'))
		: {
				databaseUrl: 'mongodb://localhost:27017/',
				databaseName: 'MaraquiaTest'
		  };
	let db = (await MongoClient.connect(
		config.databaseUrl + (config.databaseUrl.slice(-1) == '/' ? '' : '/') + config.databaseName,
		{ useNewUrlParser: true }
	)).db(config.databaseName);

	return (defaultInstance = new Maraquia(db));
}
