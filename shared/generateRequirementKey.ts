/**
 * Generate a unique, stable key for requirement mapping between compare and import
 * 
 * @param sheetName - Name of the Excel sheet
 * @param sheetOrder - Order/index of the sheet in the workbook
 * @param sheetRowIndex - Row index within the specific sheet 
 * @param requirementText - The requirement text for hash generation
 * @returns Composite key in format: sheetName:sheetOrder:sheetRowIndex:textHash
 */
export function generateRequirementKey(
  sheetName: string,
  sheetOrder: number,
  sheetRowIndex: number,
  requirementText: string
): string {
  // Handle undefined or null text safely
  const safeText = requirementText || '';
  
  // Generate stable text hash from first 50 chars, replacing spaces with underscores
  const textHash = safeText.slice(0, 50).replace(/\s+/g, '_');
  
  // Return composite key format: sheet:sheetOrder:sheetRowIndex:textHash
  return `${sheetName}:${sheetOrder}:${sheetRowIndex}:${textHash}`;
}