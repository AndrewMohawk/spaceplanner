import React, { useState } from 'react';

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

function Toolbar({
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

  const handleAddCustomFurniture = () => {
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);
    if (width > 0 && height > 0) {
      onAddFurniture({
        id: `custom-${Date.now()}`, // Simple unique ID
        name: customName || 'Custom Item',
        width: width,
        height: height,
      });
      // Optionally clear fields after adding
      // setCustomName('Custom Item');
      // setCustomWidth('');
      // setCustomHeight('');
    } else {
      alert('Please enter valid positive numbers for width and height.');
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
        <button onClick={onSetScaleMode} disabled={isSettingScale}>
          {isSettingScale ? 'Click two points on image...' : 'Draw Scale Line'}
        </button>
        {scale.points.length === 2 && (
          <div className="scale-input-group">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={scaleInput}
              onChange={onScaleInputChange}
              placeholder="Length?"
            />
            <span>inches</span> {/* Assuming inches for now */}
            <button onClick={onSetScaleConfirm}>Set</button>
          </div>
        )}
         {pixelsPerInch !== null && (
            <p>Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
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
        />
        <div className="scale-input-group">
           <input
            type="number"
            value={customWidth}
            onChange={(e) => setCustomWidth(e.target.value)}
            placeholder="Width"
            min="1"
          />
          <span>" W x</span>
          <input
            type="number"
            value={customHeight}
            onChange={(e) => setCustomHeight(e.target.value)}
            placeholder="Height"
            min="1"
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
