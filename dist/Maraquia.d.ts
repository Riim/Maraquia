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
export interface IFindOptions<T> {
    limit?: number;
    resolvedFields?: Array<keyof T>;
    aggregationPipeline?: Array<Object>;
    aggregationOptions?: CollectionAggregationOptions;
}
export declare class Maraquia {
    db: Db;
    constructor(db: Db);
    exists<T = any>(type: typeof BaseModel, query: FilterQuery<T>): Promise<boolean>;
    find<T extends BaseModel>(type: typeof BaseModel, query: FilterQuery<T>, limit?: number, resolvedFields?: Array<keyof T>, aggregationPipeline?: Array<Object>, aggregationOptions?: CollectionAggregationOptions): Promise<Array<T>>;
    find<T extends BaseModel>(type: typeof BaseModel, query: FilterQuery<T>, options?: IFindOptions<T>): Promise<Array<T>>;
    findOne<T extends BaseModel>(type: typeof BaseModel, query: FilterQuery<T>, resolvedFields?: Array<keyof T>): Promise<T | null>;
    findAll<T extends BaseModel>(type: typeof BaseModel, query: FilterQuery<T>, resolvedFields?: Array<keyof T>): Promise<Array<T>>;
    save(model: BaseModel): Promise<boolean>;
    _save(model: BaseModel): Promise<boolean>;
    _save$(model: BaseModel, typeSchema: ISchema, isNew: boolean, keypath: string, query: IQuery): Promise<Object>;
    remove(model: BaseModel): Promise<boolean>;
}
