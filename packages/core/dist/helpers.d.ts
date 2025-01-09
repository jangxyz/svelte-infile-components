/**
 * Check if object has property of type 'number'
 */
export declare function hasNumberProperty<T extends object, K extends string>(obj: T, property: K): obj is T & {
    [P in K]: number;
};
export declare function _summary(code: string | undefined | null, length?: number): string | null | undefined;
