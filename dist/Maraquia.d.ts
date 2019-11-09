import { CollectionAggregationOptions, Db, DeleteWriteOpResultObject, FilterQuery } from 'mongodb';
import { BaseModel, ISchema } from './BaseModel';
export interface IQuery {
    $set?: {
        [keypath: string]: any;
    };
    $unset?: {
        [keypath: string]: any;
    };
}
export interface IFindOptions {
    sort?: Record<string, number>;
    skip?: number;
    limit?: number;
}
export declare class Maraquia {
    db: Db;
    constructor(db: Db);
    exists<T = any>(type: typeof BaseModel, query: FilterQuery<T>): Promise<boolean>;
    find<T extends BaseModel>(type: typeof BaseModel, query?: FilterQuery<T> | null, resolvedFields?: Array<keyof T> | null, options?: IFindOptions): Promise<Array<T>>;
    findOne<T extends BaseModel>(type: typeof BaseModel, query?: FilterQuery<T> | null, resolvedFields?: Array<keyof T>): Promise<T | null>;
    aggregate<T extends BaseModel>(type: typeof BaseModel, pipeline?: Array<Object>, options?: CollectionAggregationOptions): Promise<Array<T>>;
    save(model: BaseModel): Promise<boolean>;
    _save(model: BaseModel): Promise<boolean>;
    _save$(model: BaseModel, modelSchema: ISchema, isNew: boolean, keypath: string, query: IQuery): Promise<IQuery>;
    remove<T = any>(type: typeof BaseModel, query: FilterQuery<T>): Promise<DeleteWriteOpResultObject>;
    removeOne<T = any>(type: typeof BaseModel, query: FilterQuery<T>): Promise<boolean>;
    removeOne(model: BaseModel): Promise<boolean>;
}
