import { ObjectId } from 'mongodb';
import { BaseModel } from '../BaseModel';
export declare function isModelListsEqual(a: Array<BaseModel>, b: Array<BaseModel | ObjectId> | null | undefined): boolean;
