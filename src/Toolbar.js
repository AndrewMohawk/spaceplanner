import React, { useState, useEffect, useRef } from 'react';

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
  const inchesOnlyMatch = input.match(/^(\d+(\.\d+)?)\s*"?$/);
  if (inchesOnlyMatch) {
    const inches = parseFloat(inchesOnlyMatch[1]);
    return inches;
  }

  // Invalid format
  return null;
}


function Toolbar({
  // Placed Item Props
  placedFurniture,
  selectedFurnitureId,
  onSelectFurniture,
  onDeleteFurniture,
  onCloneFurniture,
  // Other Props
  onImageUpload,
  onSetScaleMode,
  scale,
  scaleInput,
  onScaleInputChange,
  onSetScaleConfirm,
  isSettingScale,
  pixelsPerInch,
  onAddFurniture,
}) {
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [customName, setCustomName] = useState('Custom Item');
  const scaleInputRef = useRef(null);

  useEffect(() => {
    if (scale.points.length === 2 && pixelsPerInch === null && !isSettingScale && scaleInputRef.current) {
      scaleInputRef.current.focus();
    }
  }, [scale.points, pixelsPerInch, isSettingScale]);

  const handleAddCustomFurniture = () => {
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);
    if (width > 0 && height > 0) {
      onAddFurniture({
        // Use a generic id prefix for custom items
        id: `custom-${Date.now()}`,
        name: customName || 'Custom Item',
        width: width,
        height: height,
      });
    } else {
      alert('Please enter valid positive numbers for custom width and height.');
    }
  };

  const handleConfirmScaleValue = () => {
    const parsedInches = parseDimensionString(scaleInput);
    if (parsedInches !== null && parsedInches > 0) {
      onSetScaleConfirm(parsedInches);
    } else {
      alert(`Invalid scale format: "${scaleInput}". Please use formats like 10', 5'6", 7.5', or 72"`);
    }
  };

  const handleScaleInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleConfirmScaleValue();
    }
  };

  const handleDeleteSelected = () => {
      if (selectedFurnitureId) {
          onDeleteFurniture(selectedFurnitureId);
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
        {scale.points.length === 2 && !isSettingScale && pixelsPerInch === null && (
          <div className="scale-input-group">
            <input
              ref={scaleInputRef}
              type="text"
              value={scaleInput}
              onChange={onScaleInputChange}
              onKeyDown={handleScaleInputKeyDown}
              placeholder="e.g., 10' or 5'6&quot; or 72&quot;"
              aria-label="Enter scale length (e.g., 10', 5'6&quot;, 72&quot;)"
            />
            <button onClick={handleConfirmScaleValue}>Set</button>
          </div>
        )}
         {pixelsPerInch !== null && (
            <p className="scale-display">Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
         )}
      </div>

       {/* --- Actions Section --- */}
       <div className="toolbar-section">
           <h3>Actions</h3>
           <button
               onClick={handleDeleteSelected}
               disabled={!selectedFurnitureId || isSettingScale}
               className="delete-button" // Add class for specific styling
            >
               Delete Selected Item
           </button>
           {/* Add other general actions here if needed */}
       </div>


      {/* --- Add Furniture Section --- */}
      <div className="toolbar-section">
        <h3>Add Furniture (inches)</h3>
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
            type="number"
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

       {/* --- Placed Items Section --- */}
       <div className="toolbar-section">
            <h3>Placed Items</h3>
            {placedFurniture.length === 0 ? (
                <p>No items placed yet.</p>
            ) : (
                <ul className="placed-furniture-list">
                    {placedFurniture.map((item) => (
                        <li
                            key={item.id}
                            className={item.id === selectedFurnitureId ? 'selected' : ''}
                            onClick={() => onSelectFurniture(item.id)} // Select item on click
                        >
                            <span className="item-name">{item.name}</span>
                            <div className="item-actions">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCloneFurniture(item.id); }} // Prevent li click
                                    title="Clone Item"
                                    className="icon-button clone-button" // Use classes for styling
                                    aria-label={`Clone ${item.name}`}
                                >
                                    {/* Placeholder for Clone Icon (e.g., using text or SVG) */}
                                    Clone
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteFurniture(item.id); }} // Prevent li click
                                    title="Delete Item"
                                    className="icon-button delete-button" // Use classes for styling
                                    aria-label={`Delete ${item.name}`}
                                >
                                    {/* Placeholder for Delete Icon (e.g., using text or SVG) */}
                                    Del
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
       </div>

    </div>
  );
}

export default Toolbar;
