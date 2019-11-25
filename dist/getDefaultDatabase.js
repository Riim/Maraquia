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
    let db = (await mongodb_1.MongoClient.connect(config.databaseUrl +
        (config.databaseUrl.slice(-1) == '/' ? '' : '/') +
        config.databaseName, { useNewUrlParser: true })).db(config.databaseName);
    return (defaultDb = db);
}
exports.getDefaultDatabase = getDefaultDatabase;