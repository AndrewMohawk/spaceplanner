import React, { useState, useEffect, useRef } from 'react';

// Helper function to parse dimension strings (e.g., "10'", "5'6\"", "7.5'", "72\"") into inches
function parseDimensionString(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  input = input.trim();
  const feetInchesMatch = input.match(/^(\d+(\.\d+)?)\s*'\s*(\d+(\.\d+)?)\s*"?$/);
  if (feetInchesMatch) {
    const feet = parseFloat(feetInchesMatch[1]);
    const inches = parseFloat(feetInchesMatch[3]);
    return (feet * 12) + inches;
  }
  const feetOnlyMatch = input.match(/^(\d+(\.\d+)?)\s*'$/);
  if (feetOnlyMatch) {
    const feet = parseFloat(feetOnlyMatch[1]);
    return feet * 12;
  }
  const inchesOnlyMatch = input.match(/^(\d+(\.\d+)?)\s*"?$/);
  if (inchesOnlyMatch) {
    const inches = parseFloat(inchesOnlyMatch[1]);
    return inches;
  }
  return null;
}


function Toolbar({
  // Furniture Template Props
  availableFurnitureTemplates, // Combined list (defaults + custom)
  onAddNewCustomFurnitureTemplate, // Function to add a new template type
  onAddFurniture, // Function to add an instance of a template to canvas

  // Placed Item Props
  placedFurniture,
  selectedFurnitureId,
  onSelectFurniture,
  onDeleteFurniture,
  onCloneFurniture,
  onOpenEditModal, // Handler to open the edit modal

  // Other Props
  onImageUpload,
  onSetScaleMode,
  scale,
  scaleInput,
  onScaleInputChange,
  onSetScaleConfirm,
  isSettingScale,
  pixelsPerInch,

  // Import / Export Handlers
  onExportLayout,
  onTriggerImport,
}) {
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [customName, setCustomName] = useState('Custom Item');
  const scaleInputRef = useRef(null);

  // Separate default and custom templates for display
  const defaultTemplates = availableFurnitureTemplates.filter(t => t.isDefault);
  const customTemplates = availableFurnitureTemplates.filter(t => !t.isDefault);

  useEffect(() => {
    if (scale.points.length === 2 && pixelsPerInch === null && !isSettingScale && scaleInputRef.current) {
      scaleInputRef.current.focus();
    }
  }, [scale.points, pixelsPerInch, isSettingScale]);

  // This handler now calls the App's function to register the template
  const handleAddCustomFurnitureTemplate = () => {
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);
    if (width > 0 && height > 0 && customName.trim()) {
      // Call the handler passed from App.js
      onAddNewCustomFurnitureTemplate({
        name: customName.trim(),
        width: width,
        height: height,
      });
      // Optionally clear fields after adding
      // setCustomName('Custom Item');
      // setCustomWidth('');
      // setCustomHeight('');
    } else {
      alert('Please enter a valid name, positive width, and positive height for the custom item.');
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

  // Handler to add all custom items
  const handleAddAllCustom = () => {
      if (pixelsPerInch === null) {
          alert("Please set the scale before adding items.");
          return;
      }
      customTemplates.forEach(item => {
          onAddFurniture(item);
      });
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
               onClick={onExportLayout}
               disabled={pixelsPerInch === null || isSettingScale} // Disable if no scale or setting scale
               className="action-button export-button" // Add class for specific styling
            >
               Export Layout
           </button>
            <button
               onClick={onTriggerImport}
               disabled={!onImageUpload || isSettingScale} // Disable if no image loaded or setting scale
               className="action-button import-button" // Add class for specific styling
            >
               Import Layout
           </button>
           <button
               onClick={handleDeleteSelected}
               disabled={!selectedFurnitureId || isSettingScale}
               className="action-button delete-button" // Add class for specific styling
            >
               Delete Selected Item
           </button>
           {/* Add other general actions here if needed */}
       </div>


      {/* --- Add Furniture Section --- */}
      <div className="toolbar-section">
        <h3>Add Furniture (inches)</h3>

        {/* Default Templates List */}
        <p>Defaults:</p>
        {defaultTemplates.length > 0 ? (
            <ul className="furniture-list">
            {defaultTemplates.map((item) => (
                <li key={item.id}>
                <span>{item.name} ({item.width}"x{item.height}")</span>
                <button onClick={() => onAddFurniture(item)} disabled={pixelsPerInch === null}>
                    Add
                </button>
                </li>
            ))}
            </ul>
        ) : (
            <p>No default items.</p> /* Should not happen with current setup */
        )}


        <hr />

        {/* Input for NEW Custom Item - MOVED HERE */}
        <p>Create New Custom Item:</p>
         <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Item Name"
          aria-label="New custom furniture item name"
        />
        <div className="scale-input-group">
           <input
            type="number"
            value={customWidth}
            onChange={(e) => setCustomWidth(e.target.value)}
            placeholder="Width"
            min="1"
            aria-label="New custom furniture width in inches"
          />
          <span>" W x</span>
          <input
            type="number"
            value={customHeight}
            onChange={(e) => setCustomHeight(e.target.value)}
            placeholder="Height"
            min="1"
            aria-label="New custom furniture height in inches"
          />
           <span>" H</span>
        </div>
        {/* This button now adds the template definition */}
        <button onClick={handleAddCustomFurnitureTemplate} disabled={pixelsPerInch === null}>
          Save & Add Custom Item
        </button>

        <hr />

        {/* Custom Templates List */}
        <div className="custom-items-header">
            <p>Custom Items:</p>
            <button
                onClick={handleAddAllCustom}
                disabled={pixelsPerInch === null || customTemplates.length === 0}
                className="add-all-button"
                title="Add one of each custom item to the canvas"
            >
                Add All
            </button>
        </div>
        {customTemplates.length > 0 ? (
            <ul className="furniture-list">
            {customTemplates.map((item) => (
                <li key={item.id}>
                <span>{item.name} ({item.width}"x{item.height}")</span>
                {/* TODO: Add delete/edit buttons for custom templates later? */}
                <button onClick={() => onAddFurniture(item)} disabled={pixelsPerInch === null}>
                    Add
                </button>
                </li>
            ))}
            </ul>
        ) : (
             <p>No custom items saved yet.</p>
        )}

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
                                    onClick={(e) => { e.stopPropagation(); onOpenEditModal(item.id); }} // Prevent li click
                                    title="Edit Item"
                                    className="icon-button edit-button" // Use classes for styling
                                    aria-label={`Edit ${item.name}`}
                                >
                                    {/* Placeholder for Edit Icon (e.g., Gear emoji or SVG) */}
                                    ⚙️
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCloneFurniture(item.id); }} // Prevent li click
                                    title="Clone Item"
                                    className="icon-button clone-button" // Use classes for styling
                                    aria-label={`Clone ${item.name}`}
                                >
                                    {/* Placeholder for Clone Icon */}
                                    ❐
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteFurniture(item.id); }} // Prevent li click
                                    title="Delete Item"
                                    className="icon-button delete-button" // Use classes for styling
                                    aria-label={`Delete ${item.name}`}
                                >
                                    {/* Placeholder for Delete Icon */}
                                    🗑️
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
