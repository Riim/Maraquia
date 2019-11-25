import { CollectionAggregationOptions, Db, DeleteWriteOpResultObject, FilterQuery, ObjectId } from 'mongodb';
export interface IFieldSchema {
    dbFieldName?: string;
    type?: () => typeof BaseModel;
    default?: any;
    validate?: ((value: any) => Error | string | boolean | undefined) | {
        validate: (value: any, options: any) => {
            error: any;
        };
    };
}
export interface IIndex {
    fields: Record<string, 1 | -1> | Array<string>;
    options?: Record<string, any>;
}
export interface ISchema {
    collectionName?: string | null;
    fields: Record<string, IFieldSchema>;
    indexes?: Array<IIndex> | null;
}
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
export declare const KEY_REFERENCE_FIELDS: unique symbol;
export declare const KEY_DB_COLLECTION_INITIALIZED: unique symbol;
export declare const KEY_DATA: unique symbol;
export declare const KEY_VALUES: unique symbol;
export declare const KEY_VALUE: unique symbol;
export declare class BaseModel {
    static $schema: ISchema;
    static [KEY_REFERENCE_FIELDS]: Set<string> | undefined;
    static [KEY_DB_COLLECTION_INITIALIZED]: true | undefined;
    static _db: Db | null;
    static get db(): Db | null;
    static use(db: Db): typeof BaseModel;
    static getDatabase(): Promise<Db>;
    static exists<T = any>(query: FilterQuery<T>): Promise<boolean>;
    static find<T extends BaseModel>(query?: FilterQuery<T> | null, resolvedFields?: Array<keyof T> | null, options?: IFindOptions): Promise<Array<T>>;
    static findOne<T extends BaseModel>(query?: FilterQuery<T> | null, resolvedFields?: Array<keyof T> | null): Promise<T | null>;
    static aggregate<T extends BaseModel>(pipeline?: Array<Object>, options?: CollectionAggregationOptions): Promise<Array<T>>;
    static remove<T = any>(query: FilterQuery<T>): Promise<DeleteWriteOpResultObject>;
    static removeOne<T = any>(query: FilterQuery<T>): Promise<boolean>;
    _db: Db | null;
    get db(): Db | null;
    use(db: Db): this;
    [KEY_DATA]: Record<string, any>;
    [KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;
    _id: ObjectId | null;
    constructor(data?: Record<string, any> | null, db?: Db);
    fetchField<T = BaseModel | Array<BaseModel>>(name: keyof this): Promise<T | null>;
    setField(name: keyof this, value: any, _key?: Symbol | string): this;
    _validateFieldValue<T>(fieldName: string, fieldSchema: IFieldSchema, value: T): T;
    save(): Promise<IQuery>;
    _save(db: Db): Promise<IQuery>;
    _buildUpdateQuery(modelSchema: ISchema, isNew: boolean, keypath: string, query: IQuery, db: Db): Promise<IQuery>;
    remove(): Promise<boolean>;
    beforeSave(): Promise<any> | void;
    afterSave(): Promise<any> | void;
    beforeRemove(): Promise<any> | void;
    afterRemove(): Promise<any> | void;
    toData(fields?: Record<string, any>, methodName?: string): Object;
    inspectData(): string;
    printData(): void;
}
