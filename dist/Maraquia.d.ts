import { CollectionAggregationOptions, Db, FilterQuery } from 'mongodb';
import { BaseModel, ISchema } from './BaseModel';
export interface IQuery {
    $set?: {
        [keypath: string]: any;
    };
    $unset?: {
        [keypath: string]: any;
    };
}
export declare class Maraquia {
    db: Db;
    constructor(db: Db);
    exists<T = any>(type: typeof BaseModel, query: FilterQuery<T>): Promise<boolean>;
    find<T extends BaseModel>(type: typeof BaseModel, query: FilterQuery<T>, resolvedFields?: Array<keyof T>): Promise<T | null>;
    findAll<T extends BaseModel>(type: typeof BaseModel, query: FilterQuery<T>, resolvedFields?: Array<keyof T>): Promise<Array<T>>;
    aggregate<T extends BaseModel>(type: typeof BaseModel, pipeline?: Array<Object>, options?: CollectionAggregationOptions): Promise<Array<T>>;
    save(model: BaseModel): Promise<boolean>;
    _save(model: BaseModel): Promise<boolean>;
    _save$(model: BaseModel, typeSchema: ISchema, isNew: boolean, keypath: string, query: IQuery): Promise<Object>;
    remove(model: BaseModel): Promise<boolean>;
}
