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
  hasImage, // Boolean: Is an image loaded?
  isScaleSet, // Boolean: Is the scale set?
  onImageUpload,
  onSetScaleMode,
  scale,
  scaleInput,
  onScaleInputChange,
  onSetScaleConfirm,
  isSettingScale,
  pixelsPerInch,

  // Import / Export / Share Handlers
  onExportLayout,
  onTriggerImport,
  onShareLayout, // New handler for sharing
  canShare, // Boolean to enable/disable share button
}) {
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [customName, setCustomName] = useState('Custom Item');
  const scaleInputRef = useRef(null);

  // State to control visibility of Upload/Scale sections
  const [showSetupUI, setShowSetupUI] = useState(!isScaleSet);

  // Update setup UI visibility when scale is set/unset
  useEffect(() => {
      setShowSetupUI(!isScaleSet);
  }, [isScaleSet]);

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
      onAddNewCustomFurnitureTemplate({
        name: customName.trim(),
        width: width,
        height: height,
      });
      // Clear inputs after successful addition
      setCustomName('Custom Item');
      setCustomWidth('');
      setCustomHeight('');
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

  // Handler for the "Re-Upload or Re-Set Scale" button
  const handleRebuildScale = () => {
      setShowSetupUI(true);
      // Note: This just reveals the UI. Resetting scale state itself
      // might need to happen in App.js if desired.
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

  // Toggle handlers for collapsible sections
  const toggleUploadSection = () => {
      if (hasImage) { // Only allow toggling if image is loaded
          setIsUploadCollapsed(!isUploadCollapsed);
      }
  };

  const toggleScaleSection = () => {
      if (isScaleSet) { // Only allow toggling if scale is set
          setIsScaleCollapsed(!isScaleCollapsed);
      }
  };


  return (
    <div className="toolbar">

       {/* --- Top Actions Bar --- */}
       <div className="toolbar-top-actions">
            <button
                onClick={onShareLayout}
                disabled={!canShare || isSettingScale}
                className="icon-action-button share-button"
                title={!canShare ? "Upload image file & set scale to enable sharing" : "Share Layout (via Link)"}
                aria-label="Share Layout"
            >
                🔗 {/* Share Icon */}
            </button>
            <button
                onClick={onExportLayout}
                disabled={pixelsPerInch === null || isSettingScale}
                className="icon-action-button export-button"
                title="Export Layout to File"
                aria-label="Export Layout"
            >
                💾 {/* Export Icon */}
            </button>
             <button
                onClick={onTriggerImport}
                disabled={isSettingScale}
                className="icon-action-button import-button"
                title="Import Layout from File"
                aria-label="Import Layout"
            >
                 ↑ {/* Import Icon */}
            </button>
       </div>

       {/* --- Conditional Setup UI --- */}
       {showSetupUI && (
           <>
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
            </>
        )}
      </div>

      {/* --- Scale Section --- */}
      <div className="toolbar-section">
         <h3>2. Set Scale</h3>
         {/* Content is now always shown if showSetupUI is true */}
         <>
             <button onClick={onSetScaleMode} disabled={isSettingScale || !hasImage}>
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
                {/* Show scale display here only if scale is set but section is open */}
                {pixelsPerInch !== null && (
                    <p className="scale-display">Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
                )}
                    )}
                    {/* Show scale display within the scale section when visible */}
                    {pixelsPerInch !== null && (
                        <p className="scale-display">Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
                    )}
                </div>
           </>
       )}

       {/* --- Button to Re-Show Setup UI --- */}
       {!showSetupUI && isScaleSet && (
            <div className="toolbar-section">
                <h3>Floor Plan Setup</h3>
                <button onClick={handleRebuildScale}>
                    Re-Upload or Re-Set Scale
                </button>
                 {/* Display scale here when setup is hidden */}
                 {pixelsPerInch !== null && (
                     <p className="scale-display">Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
                 )}
            </div>
       )}

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
            <p>No default items.</p>
        )}


        <hr />

        {/* Input for NEW Custom Item */}
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
                            onClick={() => onSelectFurniture(item.id)}
                        >
                            <span className="item-name">{item.name}</span>
                            <div className="item-actions">
                                 <button
                                    onClick={(e) => { e.stopPropagation(); onOpenEditModal(item.id); }}
                                    title="Edit Item"
                                    className="icon-button edit-button"
                                    aria-label={`Edit ${item.name}`}
                                >
                                    ⚙️
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCloneFurniture(item.id); }}
                                    title="Clone Item"
                                    className="icon-button clone-button"
                                    aria-label={`Clone ${item.name}`}
                                >
                                    ❐
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteFurniture(item.id); }}
                                    title="Delete Item"
                                    className="icon-button delete-button"
                                    aria-label={`Delete ${item.name}`}
                                >
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
