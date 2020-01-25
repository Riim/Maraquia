"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mongodb_1 = require("mongodb");
const path = require("path");
let defaultDb;
async function getDefaultDatabase() {
    if (defaultDb) {
        return defaultDb;
    }
    let configPath = path.join(process.cwd(), 'config/maraquia.json');
    let config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
        : {
            databaseUrl: 'mongodb://localhost:27017/',
            databaseName: 'MaraquiaTest'
        };
    let conn = await mongodb_1.MongoClient.connect(config.databaseUrl + (config.databaseUrl.slice(-1) == '/' ? '' : '/') + config.databaseName, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = conn.db(config.databaseName);
    db.__connection = conn;
    return (defaultDb = db);
}
exports.getDefaultDatabase = getDefaultDatabase;
