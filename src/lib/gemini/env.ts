/**
 * File Search store name
 * @returns {string} The File Search store name
 */
export function getFileSearchStoreName(): string {
  const name = process.env.FILE_SEARCH_STORE_NAME;
  if (!name) {
    throw new Error("Missing FILE_SEARCH_STORE_NAME");
  }
  return name;
}
