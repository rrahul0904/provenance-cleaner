export function transformOperationKey(operationId: string) {
  return `transform:${operationId.trim().toLowerCase()}`;
}
