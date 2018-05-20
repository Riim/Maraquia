import { Db } from 'mongodb';
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
    exists(type: typeof BaseModel, query: object): Promise<boolean>;
    find<T extends BaseModel>(type: typeof BaseModel, query: object): Promise<T | null>;
    findAll<T extends BaseModel>(type: typeof BaseModel, query: object): Promise<Array<T>>;
    save(model: BaseModel): Promise<boolean>;
    _save(model: BaseModel): Promise<boolean>;
    _save$(model: BaseModel, typeSchema: ISchema, isNew: boolean, keypath: string, query: IQuery): Promise<Object>;
    remove(model: BaseModel): Promise<boolean>;
}
