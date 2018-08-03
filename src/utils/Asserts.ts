/**
 * Asserts that the input value type is of type `never`. This is useful for exhaustiveness checking: https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking
 * @param {never} x
 * @returns {never}
 */
export function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}