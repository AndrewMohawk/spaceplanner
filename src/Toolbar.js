import React, { useState, useEffect } from 'react'; // Added useEffect

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
  scale, // { points: [{x,y}, {x,y}], pixelLength: number }
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
  const scaleInputRef = React.useRef(null); // Ref for the scale input

  // Automatically focus the scale input when it appears
  useEffect(() => {
    if (scale.points.length === 2 && scaleInputRef.current) {
      scaleInputRef.current.focus();
      // Optionally select the text too
      // scaleInputRef.current.select();
    }
  }, [scale.points]); // Dependency on scale points changing

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

  // Handle Enter key press in scale input
  const handleScaleInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      onSetScaleConfirm();
    }
  };

  // console.log("Toolbar rendering, scale prop:", scale); // Debug log

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
        {scale.points.length === 2 && !isSettingScale && pixelsPerInch === null && (
          <div className="scale-input-group">
            <input
              ref={scaleInputRef} // Assign ref
              type="number"
              min="0.1"
              step="0.1"
              value={scaleInput}
              onChange={onScaleInputChange}
              onKeyDown={handleScaleInputKeyDown} // Handle Enter key
              placeholder="Length?"
              aria-label="Enter scale length in inches"
            />
            <span>inches</span> {/* Assuming inches for now */}
            <button onClick={onSetScaleConfirm}>Set</button>
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
    </div>
  );
}

export default Toolbar;
