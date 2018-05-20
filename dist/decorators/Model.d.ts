import { BaseModel, IIndex } from '../BaseModel';
export declare function Model(options?: {
    collectionName?: string | null;
    indexes?: Array<IIndex> | null;
}): (type: typeof BaseModel) => void;
