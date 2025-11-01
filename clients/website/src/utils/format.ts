
export function truncate(str: String, n: number) {
  return str.length > n ? str.slice(0, n - 1) + "..." : str;
}

export function formatDate(timestamp: number) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return new Date(timestamp).toLocaleDateString("en-US", options);
}