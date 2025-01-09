/**
 * Wrap LSP apis
 */
export function wrap<P extends unknown[], R>(
  msg: string | false | (() => string | false),
  f: (...args: P) => R,
) {
  return (...args: P): R => {
    if (typeof msg === 'function') {
      msg = msg();
    }

    const start = performance.now();
    const prefix = `[${start / 1000}]`;

    if (msg !== false) {
      console.log(`\n${prefix} ${msg}`, args);
    }

    const result = f(...args);

    if (msg === false || result === undefined) {
      return result;
    }

    const end = performance.now();
    const took = (end - start) / 1000;
    const prefix2 = `${prefix}(${took})`;

    if (isPromiseLike(result)) {
      result.then((answer: unknown) => {
        console.log('<==', prefix2, msg, 'THEN', answer);
      });
    } else {
      console.log('<==', prefix2, msg, result);
    }

    return result;

    ///

    function isPromiseLike(
      x: unknown,
    ): x is object & { then: (...args: unknown[]) => unknown } {
      if (typeof x !== 'object') return false;
      if (x === null) return false;
      if (!('then' in x)) return false;
      return typeof x['then'] === 'function';
    }
  };
}

export function trying<T>(
  callback: () => T,
  catchError?: (err: unknown) => void,
): [T | undefined, null | unknown] {
  let result: T | undefined = undefined;
  let reason: null | unknown = null;
  try {
    result = callback();
  } catch (err) {
    reason = err;
    catchError?.(err);
  } finally {
    return [result, reason] as const;
  }
}
