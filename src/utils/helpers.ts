/**
 * Generates a unique ID with a given prefix.
 * e.g., generateId('prod') => 'prod_1678886400000_a1b2c3d4'
 * @param prefix - The prefix for the ID (e.g., 'prod', 'user').
 * @returns A unique string ID.
 */
export const generateId = (prefix: string): string => {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${timestamp}-${randomPart}`;
};


/**
 * Converts a Date object to a 'YYYY-MM-DD' string.
 * @param date - The date to convert.
 * @returns The formatted date string.
 */
export const toDateInputString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
