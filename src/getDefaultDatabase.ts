import * as fs from 'fs';
import { Db, MongoClient } from 'mongodb';
import * as path from 'path';

let defaultDb: Db | undefined;

export async function getDefaultDatabase(): Promise<Db> {
	if (defaultDb) {
		return defaultDb;
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
	let conn = await MongoClient.connect(
		config.databaseUrl + (config.databaseUrl.slice(-1) == '/' ? '' : '/') + config.databaseName,
		{
			useNewUrlParser: true,
			useUnifiedTopology: true
		}
	);
	let db = conn.db(config.databaseName);

	(db as any).__connection = conn;

	return (defaultDb = db);
}
