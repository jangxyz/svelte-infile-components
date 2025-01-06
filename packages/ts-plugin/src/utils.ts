//
// strings
//

export function split(str: string, sep: string, limit?: number) {
  const allSplits = str.split(sep);
  if (limit === undefined) return allSplits;
  if (limit > allSplits.length) return allSplits;

  const splits = allSplits.slice(0, limit - 1);
  const rest = allSplits.slice(limit - 1);

  return splits.concat(rest.join(sep));
}

//
// objects
//

export function omit<T extends object, K extends keyof T | string>(
  obj: T,
  ...omitKeys: K[]
): Omit<T, K> {
  const result: Partial<T> = {};

  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (omitKeys.includes(key as any)) {
      continue;
    }

    result[key] = obj[key];
  }

  return result as Omit<T, K>;
}

export function replace<T extends object, K extends keyof T, V>(
  obj: T,
  key: K,
  value: V,
): Omit<T, K> & { [key in K]: V } {
  //const result = {} as { [P in keyof T]: P extends K ? V : T[P] };
  const result = {} as unknown as T;

  for (const objKey of Object.keys(obj) as (keyof T)[]) {
    if (objKey === key) {
      result[objKey] = value as any;
    } else {
      result[objKey] = obj[objKey] as any;
    }
  }

  return result as Omit<T, K> & { [key in K]: V };
}

export function buildObjectProxy<T extends object>(obj: T): T {
  const proxy: T = Object.create(null);

  for (let key of Object.keys(obj ?? {}) as (keyof T)[]) {
    const method = obj[key]!;
    // @ts-expect-error - JS runtime trickery which is tricky to type tersely
    proxy[key] = (...args: {}[]) => method.apply(obj, args);
  }

  return proxy;
}

export function getProperty<V = unknown>(
  obj: object,
  key: string,
): V | undefined {
  return key in obj ? (obj[key as keyof typeof obj] as V) : undefined;
}

export function assertProperty<
  T extends object,
  K extends keyof T,
  V = unknown,
>(obj: T, key: K): asserts obj is T & { [k in K]: V } {
  const value = key in obj ? (obj[key as keyof typeof obj] as V) : undefined;
}

//
// functions
//

export function returning<T>(value: T, callback: (value: T) => void): T {
  try {
    callback(value);
  } catch (err) {
    console.warn(err);
  } finally {
    return value;
  }
}

//
// errors
//

export function unreachable(msg = 'unreachable case'): never {
  throw new Error(msg);
}
