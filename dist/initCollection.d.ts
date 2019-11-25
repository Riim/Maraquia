import { Db } from 'mongodb';
import { BaseModel } from './BaseModel';
export declare function initCollection(type: typeof BaseModel, db: Db): Promise<void>;
