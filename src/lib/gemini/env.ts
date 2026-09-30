/**
 * File Search store name
 * @returns {string} The File Search store name
 */
export function getFileSearchStoreName(): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  const name = isDevelopment
    ? process.env.FILE_SEARCH_TEST_STORE_NAME
    : process.env.FILE_SEARCH_STORE_NAME;

  if (!name) {
    throw new Error(
      isDevelopment
        ? "Missing FILE_SEARCH_TEST_STORE_NAME"
        : "Missing FILE_SEARCH_STORE_NAME",
    );
  }

  return name;
}
