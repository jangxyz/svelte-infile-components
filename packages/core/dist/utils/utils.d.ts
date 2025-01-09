export declare class UnreachableError extends Error {
}
export declare function unreachable(msg?: string): never;
export declare function nonNullable<T>(value: T): value is NonNullable<T>;
