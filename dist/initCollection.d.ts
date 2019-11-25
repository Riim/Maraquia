import { Db } from 'mongodb';
import { BaseModel } from './BaseModel';
export declare function initCollection(modelCtor: typeof BaseModel, db: Db): Promise<void>;
