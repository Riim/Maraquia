import { ObjectId } from 'mongodb';
import { Maraquia } from './Maraquia';
export interface IFieldSchema {
    dbFieldName?: string;
    type?: () => typeof BaseModel;
    default?: any;
    validate?: ((value: any) => Error | string | boolean | undefined) | {
        validate: (value: any) => {
            error: any;
        };
    };
}
export interface IIndex {
    fields: {
        [name: string]: 1 | -1;
    } | Array<string>;
    options?: {
        [name: string]: any;
    };
}
export interface ISchema {
    collectionName?: string | null;
    fields: {
        [name: string]: IFieldSchema;
    };
    indexes?: Array<IIndex> | null;
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
    static exists(query: object, m?: Maraquia): Promise<boolean>;
    static find<T extends BaseModel>(query: object, m?: Maraquia): Promise<T | null>;
    static find<T extends BaseModel>(query: object, resolvedFields: Array<string>, m?: Maraquia): Promise<T | null>;
    static findAll<T extends BaseModel>(query: object, m?: Maraquia): Promise<Array<T>>;
    static findAll<T extends BaseModel>(query: object, resolvedFields: Array<string>, m?: Maraquia): Promise<Array<T>>;
    m: Maraquia;
    [KEY_DATA]: {
        [name: string]: any;
    };
    [KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;
    _id: ObjectId | null;
    constructor(data?: {
        [name: string]: any;
    }, m?: Maraquia);
    fetchField<T = BaseModel | Array<BaseModel>>(name: string, m?: Maraquia): Promise<T | null>;
    setField(name: string, value: any, _key?: Symbol | string): this;
    _validateFieldValue<T>(fieldName: string, fieldSchema: IFieldSchema, value: T): T;
    save(m?: Maraquia): Promise<boolean>;
    remove(m?: Maraquia): Promise<boolean>;
    beforeSave: (() => Promise<any> | void) | undefined;
    afterSave: (() => Promise<any> | void) | undefined;
    beforeRemove: (() => Promise<any> | void) | undefined;
    afterRemove: (() => Promise<any> | void) | undefined;
    toObject(): Object;
    inspectData(): string;
    printData(): void;
}
