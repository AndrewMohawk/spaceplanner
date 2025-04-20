// Utility functions for interacting with localStorage

const SCALES_KEY = 'floorPlanScales';
const CUSTOM_FURNITURE_KEY = 'customFurnitureTemplates';

// --- Scale Persistence ---

/**
 * Saves scale information for a specific image identifier.
 * @param {string} imageIdentifier - Unique identifier for the image (e.g., "filename|size").
 * @param {number} pixelsPerInch - The calculated scale.
 */
export function saveScaleForImage(imageIdentifier, pixelsPerInch) {
  try {
    const allScales = getSavedScales();
    allScales[imageIdentifier] = pixelsPerInch;
    localStorage.setItem(SCALES_KEY, JSON.stringify(allScales));
  } catch (error) {
    console.error("Error saving scale to localStorage:", error);
  }
}

/**
 * Retrieves the saved scale for a specific image identifier.
 * @param {string} imageIdentifier - Unique identifier for the image.
 * @returns {number | null} The saved scale or null if not found or error.
 */
export function getScaleForImage(imageIdentifier) {
  try {
    const allScales = getSavedScales();
    return allScales[imageIdentifier] ?? null;
  } catch (error) {
    console.error("Error getting scale from localStorage:", error);
    return null;
  }
}

/**
 * Retrieves all saved scales.
 * @returns {object} An object mapping image identifiers to scales.
 */
export function getSavedScales() {
  try {
    const saved = localStorage.getItem(SCALES_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("Error getting all scales from localStorage:", error);
    return {};
  }
}


// --- Custom Furniture Persistence ---

/**
 * Saves the list of custom furniture templates.
 * @param {Array<object>} customTemplates - Array of custom furniture template objects.
 */
export function saveCustomFurnitureTemplates(customTemplates) {
  try {
    localStorage.setItem(CUSTOM_FURNITURE_KEY, JSON.stringify(customTemplates));
  } catch (error) {
    console.error("Error saving custom furniture templates to localStorage:", error);
  }
}

/**
 * Loads the list of custom furniture templates.
 * @returns {Array<object>} Array of custom furniture template objects.
 */
export function loadCustomFurnitureTemplates() {
  try {
    const saved = localStorage.getItem(CUSTOM_FURNITURE_KEY);
    // Add basic validation to ensure it's an array
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error loading custom furniture templates from localStorage:", error);
    return [];
  }
}
