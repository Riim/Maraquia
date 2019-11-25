import { Db } from 'mongodb';
import { BaseModel } from './BaseModel';

export async function initDocument(model: BaseModel, db: Db, collectionName: string) {
	model._id = (await db.collection(collectionName).insertOne({})).insertedId as any;
}
