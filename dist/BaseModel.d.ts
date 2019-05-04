import { CollectionAggregationOptions, FilterQuery, ObjectId } from 'mongodb';
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
    fields: Record<string, 1 | -1> | Array<string>;
    options?: Record<string, any>;
}
export interface ISchema {
    collectionName?: string | null;
    fields: Record<string, IFieldSchema>;
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
    static exists<T = any>(query: FilterQuery<T>, m?: Maraquia): Promise<boolean>;
    static find<T extends BaseModel>(query: FilterQuery<T>, m?: Maraquia): Promise<T | null>;
    static find<T extends BaseModel>(query: FilterQuery<T>, resolvedFields: Array<keyof T>, m?: Maraquia): Promise<T | null>;
    static findAll<T extends BaseModel>(query: FilterQuery<T>, m?: Maraquia): Promise<Array<T>>;
    static findAll<T extends BaseModel>(query: FilterQuery<T>, resolvedFields: Array<keyof T>, m?: Maraquia): Promise<Array<T>>;
    static aggregate<T extends BaseModel>(pipeline?: Array<Object>, options?: CollectionAggregationOptions, m?: Maraquia): Promise<Array<T>>;
    m: Maraquia;
    [KEY_DATA]: Record<string, any>;
    [KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;
    _id: ObjectId | null;
    constructor(data?: Record<string, any> | null, m?: Maraquia);
    fetchField<T = BaseModel | Array<BaseModel>>(name: keyof this, m?: Maraquia): Promise<T | null>;
    setField(name: keyof this, value: any, _key?: Symbol | string): this;
    _validateFieldValue<T>(fieldName: string, fieldSchema: IFieldSchema, value: T): T;
    save(m?: Maraquia): Promise<boolean>;
    remove(m?: Maraquia): Promise<boolean>;
    beforeSave: (() => Promise<any> | void) | undefined;
    afterSave: (() => Promise<any> | void) | undefined;
    beforeRemove: (() => Promise<any> | void) | undefined;
    afterRemove: (() => Promise<any> | void) | undefined;
    toObject(fields?: Record<string, true | Record<string, true | Record<string, any>>>): Object;
    inspectData(): string;
    printData(): void;
}
