import { Db } from 'mongodb';
import { BaseModel } from './BaseModel';
export declare function initDocument(model: BaseModel, db: Db, collectionName: string): Promise<void>;
