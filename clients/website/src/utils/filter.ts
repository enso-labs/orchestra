
export function findByProperty(
  items: any[],
  propertyName: string,
  propertyValue: string,
): any | undefined {
  // Use the find method to search for the item with the matching property
  const item = items.find((item) => item[propertyName] === propertyValue);
  return item;
}