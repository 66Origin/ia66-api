/**
 * File Search store name
 * @returns {string} The File Search store name
 */
export function getFileSearchStoreName(): string {
  const isLocalDevelopment = process.env.NODE_ENV === "development";
  const isVercelPreview = process.env.VERCEL_ENV === "preview";

  const useTestStore = isLocalDevelopment || isVercelPreview;

  const name = useTestStore
    ? process.env.FILE_SEARCH_TEST_STORE_NAME
    : process.env.FILE_SEARCH_STORE_NAME;

  if (!name) {
    throw new Error(
      useTestStore
        ? "Missing FILE_SEARCH_TEST_STORE_NAME"
        : "Missing FILE_SEARCH_STORE_NAME",
    );
  }

  return name;
}
