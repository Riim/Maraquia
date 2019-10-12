import { BaseModel, IIndex } from '../BaseModel';
export declare function Model(options?: {
    collectionName?: string | null;
    indexes?: Array<IIndex> | null;
}): (modelConstr: typeof BaseModel) => void;
