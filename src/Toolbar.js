import React, { useState, useEffect, useRef } from 'react'; // Added useRef

// Default furniture items (dimensions in inches)
const DEFAULT_FURNITURE = [
  { id: 'couch-1', name: 'Sofa (3-seat)', width: 84, height: 38 },
  { id: 'couch-2', name: 'Loveseat', width: 60, height: 38 },
  { id: 'chair-1', name: 'Armchair', width: 35, height: 35 },
  { id: 'bed-q', name: 'Bed (Queen)', width: 60, height: 80 },
  { id: 'bed-k', name: 'Bed (King)', width: 76, height: 80 },
  { id: 'desk-1', name: 'Desk', width: 48, height: 24 },
  { id: 'table-dr', name: 'Dining Table (6)', width: 60, height: 36 },
];

// Helper function to parse dimension strings (e.g., "10'", "5'6\"", "7.5'", "72\"") into inches
function parseDimensionString(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  input = input.trim();

  // Match feet and inches (e.g., 10'6", 5' 8", 12' 0")
  // Updated regex to handle optional inches quote
  const feetInchesMatch = input.match(/^(\d+(\.\d+)?)\s*'\s*(\d+(\.\d+)?)\s*"?$/);
  if (feetInchesMatch) {
    const feet = parseFloat(feetInchesMatch[1]);
    const inches = parseFloat(feetInchesMatch[3]);
    return (feet * 12) + inches;
  }

  // Match only feet (e.g., 10', 7.5')
  const feetOnlyMatch = input.match(/^(\d+(\.\d+)?)\s*'$/);
  if (feetOnlyMatch) {
    const feet = parseFloat(feetOnlyMatch[1]);
    return feet * 12;
  }

  // Match only inches (e.g., 72", 36) - allow number without "
  // Updated regex to handle optional inches quote
  const inchesOnlyMatch = input.match(/^(\d+(\.\d+)?)\s*"?$/);
  if (inchesOnlyMatch) {
    const inches = parseFloat(inchesOnlyMatch[1]);
    return inches;
  }

  // Invalid format
  return null;
}


function Toolbar({
  onImageUpload,
  onSetScaleMode,
  scale, // { points: [{x,y}, {x,y}], pixelLength: number }
  scaleInput, // Raw string value from input
  onScaleInputChange, // Function to update raw string value in App state
  onSetScaleConfirm, // Function in App to finalize scale (expects inches)
  isSettingScale,
  pixelsPerInch,
  onAddFurniture,
}) {
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [customName, setCustomName] = useState('Custom Item');
  const scaleInputRef = useRef(null); // Ref for the scale input

  // Automatically focus the scale input when it appears
  useEffect(() => {
    // Focus when 2 points are selected AND scale is not yet set
    if (scale.points.length === 2 && pixelsPerInch === null && !isSettingScale && scaleInputRef.current) {
      scaleInputRef.current.focus();
      // Optionally select the text too
      // scaleInputRef.current.select();
    }
  }, [scale.points, pixelsPerInch, isSettingScale]); // Dependencies updated

  const handleAddCustomFurniture = () => {
    const width = parseFloat(customWidth); // Keep custom input simple for now
    const height = parseFloat(customHeight);
    if (width > 0 && height > 0) {
      onAddFurniture({
        id: `custom-${Date.now()}`, // Simple unique ID
        name: customName || 'Custom Item',
        width: width,
        height: height,
      });
    } else {
      alert('Please enter valid positive numbers for custom width and height.');
    }
  };

  // Internal handler to parse the input and call the App's confirm function
  const handleConfirmScaleValue = () => {
    const parsedInches = parseDimensionString(scaleInput);

    if (parsedInches !== null && parsedInches > 0) {
      onSetScaleConfirm(parsedInches); // Pass the calculated inches value up to App
    } else {
      alert(`Invalid scale format: "${scaleInput}". Please use formats like 10', 5'6", 7.5', or 72"`);
    }
  };

  // Handle Enter key press in scale input
  const handleScaleInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleConfirmScaleValue(); // Call the parsing/confirm handler
    }
  };

  return (
    <div className="toolbar">
      {/* --- Upload Section --- */}
      <div className="toolbar-section">
        <h3>1. Upload Floor Plan</h3>
        <label htmlFor="floorplan-upload">Select Image:</label>
        <input
          type="file"
          id="floorplan-upload"
          accept="image/*"
          onChange={onImageUpload}
        />
      </div>

      {/* --- Scale Section --- */}
      <div className="toolbar-section">
        <h3>2. Set Scale</h3>
        <button onClick={onSetScaleMode} disabled={isSettingScale || !onImageUpload}>
          {isSettingScale ? 'Click two points on image...' : 'Draw Scale Line'}
        </button>
        {/* Conditional rendering for the scale input group */}
        {/* Show input when 2 points are selected AND scale is not yet confirmed */}
        {scale.points.length === 2 && !isSettingScale && pixelsPerInch === null && (
          <div className="scale-input-group">
            <input
              ref={scaleInputRef} // Assign ref
              type="text" // Changed type to text
              value={scaleInput} // Controlled input with string value
              onChange={onScaleInputChange} // Update string value in App state
              onKeyDown={handleScaleInputKeyDown} // Handle Enter key
              placeholder="e.g., 10' or 5'6&quot; or 72&quot;" // Use &quot; for inner quotes
              aria-label="Enter scale length (e.g., 10', 5'6&quot;, 72&quot;)" // Use &quot; for inner quotes
            />
            {/* Removed span with "inches" */}
            <button onClick={handleConfirmScaleValue}>Set</button> {/* Calls internal handler */}
          </div>
        )}
         {pixelsPerInch !== null && (
            <p className="scale-display">Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
         )}
      </div>

      {/* --- Furniture Section --- */}
      <div className="toolbar-section">
        <h3>3. Add Furniture (inches)</h3>
        <p>Defaults:</p>
        <ul className="furniture-list">
          {DEFAULT_FURNITURE.map((item) => (
            <li key={item.id}>
              <span>{item.name} ({item.width}"x{item.height}")</span>
              <button onClick={() => onAddFurniture(item)} disabled={pixelsPerInch === null}>
                Add
              </button>
            </li>
          ))}
        </ul>
        <hr />
        <p>Custom:</p>
         <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Item Name"
          aria-label="Custom furniture item name"
        />
        <div className="scale-input-group">
           <input
            type="number" // Keep custom furniture input as simple numbers (inches) for now
            value={customWidth}
            onChange={(e) => setCustomWidth(e.target.value)}
            placeholder="Width"
            min="1"
            aria-label="Custom furniture width in inches"
          />
          <span>" W x</span>
          <input
            type="number"
            value={customHeight}
            onChange={(e) => setCustomHeight(e.target.value)}
            placeholder="Height"
            min="1"
            aria-label="Custom furniture height in inches"
          />
           <span>" H</span>
        </div>
        <button onClick={handleAddCustomFurniture} disabled={pixelsPerInch === null}>
          Add Custom Item
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
