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

  // State for collapsible sections
  const [isUploadCollapsed, setIsUploadCollapsed] = useState(hasImage);
  const [isScaleCollapsed, setIsScaleCollapsed] = useState(isScaleSet);

  // Update collapsed state when props change (e.g., image uploaded or scale set)
  useEffect(() => {
      // Collapse upload section only if an image is present
      setIsUploadCollapsed(hasImage);
  }, [hasImage]);

  useEffect(() => {
      // Collapse scale section only if the scale is actually set
      setIsScaleCollapsed(isScaleSet);
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
            <button
                onClick={handleDeleteSelected}
                disabled={!selectedFurnitureId || isSettingScale}
                className="icon-action-button delete-button"
                title="Delete Selected Item (Del/Backspace)"
                aria-label="Delete Selected Item"
            >
                🗑️ {/* Delete Icon */}
            </button>
       </div>


      {/* --- Upload Section (Collapsible) --- */}
      <div className="toolbar-section">
        <h3
            className={`collapsible-header ${hasImage ? 'collapsible' : ''}`}
            onClick={toggleUploadSection}
            aria-expanded={!isUploadCollapsed}
            title={hasImage ? (isUploadCollapsed ? 'Expand Upload Section' : 'Collapse Upload Section') : ''}
        >
            1. Upload Floor Plan {hasImage && (isUploadCollapsed ? '►' : '▼')}
        </h3>
        {(!hasImage || !isUploadCollapsed) && ( // Show if no image OR if not collapsed
            <>
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

      {/* --- Scale Section (Collapsible) --- */}
      <div className="toolbar-section">
         <h3
            className={`collapsible-header ${isScaleSet ? 'collapsible' : ''}`}
            onClick={toggleScaleSection}
            aria-expanded={!isScaleCollapsed}
            title={isScaleSet ? (isScaleCollapsed ? 'Expand Scale Section' : 'Collapse Scale Section') : ''}
        >
            2. Set Scale {isScaleSet && (isScaleCollapsed ? '►' : '▼')}
        </h3>
        {(!isScaleSet || !isScaleCollapsed) && ( // Show if scale not set OR if not collapsed
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
            </>
        )}
         {/* Always show the scale display if it's set AND collapsed */}
         {isScaleSet && isScaleCollapsed && pixelsPerInch !== null && (
             <p className="scale-display">Scale: 1 inch ≈ {pixelsPerInch.toFixed(2)} pixels</p>
         )}
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
