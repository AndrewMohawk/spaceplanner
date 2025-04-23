import React, { useState, useRef, useEffect } from 'react';
import 'rc-slider/assets/index.css';

// Helper function to parse dimension strings (e.g., "10'", "5'6", "7.5'", "72") into inches
function parseDimensionString(input) {
  // Remove all whitespace
  input = input.replace(/\s+/g, '');
  
  // Check if the input is a simple number (interpreted as inches)
  if (/^\d+(\.\d+)?$/.test(input)) {
    return parseFloat(input);
  }
  
  // Check for feet and inches notation: e.g., 5'6", 5'6, 5', etc.
  const feetInchesPattern = /^(\d+(?:\.\d+)?)'(?:(\d+(?:\.\d+)?)(?:"))?$/;
  const feetInchesMatch = input.match(feetInchesPattern);
  
  if (feetInchesMatch) {
    const feet = parseFloat(feetInchesMatch[1]) || 0;
    const inches = parseFloat(feetInchesMatch[2] || '0');
    return feet * 12 + inches;
  }
  
  // Check for inches notation with double quote: e.g., 5", 5.5"
  const inchesPattern = /^(\d+(?:\.\d+)?)"$/;
  const inchesMatch = input.match(inchesPattern);
  
  if (inchesMatch) {
    return parseFloat(inchesMatch[1]);
  }
  
  // Return null for invalid input
  return null;
}

function Toolbar({
  // Furniture Template Props
  availableFurnitureTemplates, // Combined list (defaults + custom)
  onAddNewCustomFurnitureTemplate, // Function to add a new template type
  onAddFurniture, // Function to add an instance of a template to canvas
  onUpdateCustomFurnitureTemplate, // Function to update an existing template

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
  onShareLayout, // Uncommented for share functionality
  canShare, // Uncommented for share functionality
}) {
  // Split available templates into default and custom
  const defaultTemplates = availableFurnitureTemplates.filter(
    template => !template.isCustom
  );
  const customTemplates = availableFurnitureTemplates.filter(
    template => template.isCustom
  );
  
  // Setup state for custom template form
  const [newFurnitureName, setNewFurnitureName] = useState("");
  const [newFurnitureWidth, setNewFurnitureWidth] = useState("");
  const [newFurnitureHeight, setNewFurnitureHeight] = useState("");
  const [newFurnitureColor, setNewFurnitureColor] = useState("#3182CE");
  const [newFurnitureGlobal, setNewFurnitureGlobal] = useState(true);
  
  // Collapsible section states
  const [isCustomItemsCollapsed, setIsCustomItemsCollapsed] = useState(false);
  const [isDefaultsCollapsed, setIsDefaultsCollapsed] = useState(false);
  
  // State for editing templates
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isEditTemplateModalOpen, setIsEditTemplateModalOpen] = useState(false);
  
  // Reference for auto-focusing the scale input
  const scaleInputRef = useRef(null);
  
  // Auto-focus the scale input when it appears
  useEffect(() => {
    if (scale.points.length === 2 && scaleInputRef.current) {
      scaleInputRef.current.focus();
    }
  }, [scale.points]);
  
  const handleAddCustomFurnitureTemplate = () => {
    // Parse the width and height inputs
    const parsedWidth = parseDimensionString(newFurnitureWidth);
    const parsedHeight = parseDimensionString(newFurnitureHeight);
    
    // Only proceed if we have valid dimensions
    if (parsedWidth && parsedHeight) {
      onAddNewCustomFurnitureTemplate({
        name: newFurnitureName || "Custom Item",
        width: parsedWidth,
        height: parsedHeight,
        color: newFurnitureColor,
        isGlobal: newFurnitureGlobal, // Add the global/local flag
      });
      
      // Reset form
      setNewFurnitureName("");
      setNewFurnitureWidth("");
      setNewFurnitureHeight("");
    }
  };
  
  // Add handler for editing templates
  const handleEditCustomTemplate = (templateId) => {
    const template = customTemplates.find(t => t.id === templateId);
    if (template) {
      setEditingTemplate(template);
      setIsEditTemplateModalOpen(true);
    }
  };

  // Add handler for saving edited template changes
  const handleSaveTemplateEdit = (templateId, changes) => {
    const updatedTemplate = {
      ...customTemplates.find(t => t.id === templateId),
      ...changes
    };
    
    // Call parent handler to update templates
    if (typeof onUpdateCustomFurnitureTemplate === 'function') {
      onUpdateCustomFurnitureTemplate(updatedTemplate);
    }
    
    // Close the modal
    setIsEditTemplateModalOpen(false);
    setEditingTemplate(null);
  };
  
  const handleConfirmScaleValue = () => {
    const parsedValue = parseDimensionString(scaleInput);
    if (parsedValue) {
      onSetScaleConfirm(parsedValue);
    }
  };
  
  const handleScaleInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleConfirmScaleValue();
    }
  };
  
  const handleAddAllCustom = () => {
    if (customTemplates.length > 0 && pixelsPerInch !== null && !isSettingScale) {
      customTemplates.forEach(template => onAddFurniture(template));
    }
  };

  // Scale setting UI - shown when we're in scale setting mode
  // or when scale points are set but scale is not confirmed
  const renderScaleUI = () => {
    if (isSettingScale || (scale.points.length === 2 && pixelsPerInch === null)) {
      return (
        <div className="scale-setting-ui">
          <h3>Setting Scale</h3>
          
          {isSettingScale && scale.points.length === 0 && (
            <p>Click on the first point of a known distance in your floor plan.</p>
          )}
          
          {isSettingScale && scale.points.length === 1 && (
            <p>Now click on the second point of the known distance.</p>
          )}
          
          {scale.points.length === 2 && pixelsPerInch === null && (
            <div className="scale-input-group">
              <p>Enter the real-world distance between the two points:</p>
              <input
                ref={scaleInputRef}
                type="text"
                placeholder={'e.g., 10\' or 120"'}
                value={scaleInput}
                onChange={onScaleInputChange}
                onKeyDown={handleScaleInputKeyDown}
              />
              <button onClick={handleConfirmScaleValue}>Set Scale</button>
              <p className="scale-help-text">
                {'(Enter feet and inches like "10\'6\'" or just inches like "120")'}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Check if we should hide the main toolbar content
  // Hide when: no image is loaded, or scale setting is in progress
  const shouldHideToolbarContent = !hasImage || isSettingScale || (scale.points.length === 2 && pixelsPerInch === null);

  // If we have no image or are setting scale, show appropriate UI
  if (!hasImage) {
    return (
      <div className="toolbar">
        <div className="toolbar-header">
          <div className="logo-container">
            <img src="/spaceplanner-logo.png" alt="SpacePlanner Logo" className="toolbar-logo" />
          </div>
        </div>
        <div className="toolbar-section initial-setup">
          <h3>Get Started</h3>
          <p>Upload a floor plan image to begin arranging furniture.</p>
          <button 
            onClick={onImageUpload} 
            className="primary-button"
          >
            Upload Floor Plan Image
          </button>
        </div>
      </div>
    );
  }

  // If we're setting scale, show minimal UI
  if (shouldHideToolbarContent) {
    return (
      <div className="toolbar">
        <div className="toolbar-header">
          <div className="logo-container">
            <img src="/spaceplanner-logo.png" alt="SpacePlanner Logo" className="toolbar-logo" />
          </div>
        </div>
        {renderScaleUI()}
      </div>
    );
  }

  // Normal toolbar content - shown when image is loaded and scale is set
  return (
    <div className="toolbar">
      {/* Simplified Toolbar Header */}
      <div className="toolbar-header">
        <div className="logo-container">
          <img src="/spaceplanner-logo.png" alt="SpacePlanner Logo" className="toolbar-logo" />
        </div>
        <div className="toolbar-top-actions">
          <button
            className="icon-action-button upload-button"
            onClick={onImageUpload}
            disabled={isSettingScale}
            title="Upload floor plan image or load layout JSON file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Load Layout
          </button>
          
          <div className="button-container">
          <button
              className="icon-action-button download-button"
            onClick={onExportLayout}
              disabled={!hasImage || !isScaleSet || isSettingScale}
              title="Save furniture arrangement as JSON file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
              Save Layout
          </button>
            {(!hasImage || !isScaleSet || isSettingScale) && (
              <div className="button-tooltip">
                {!hasImage ? 'Upload an image first' : !isScaleSet ? 'Set scale first' : 'Finish setting scale'}
              </div>
            )}
          </div>
          
          <div className="button-container">
          <button
              className="icon-action-button share-button"
              onClick={onShareLayout}
              disabled={!canShare || isSettingScale}
          >
            <div className="share-icon-container">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="share-icon">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="config-icon">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            Share
          </button>
            {(!canShare || isSettingScale) && (
              <div className="button-tooltip">
                {!canShare ? 'Upload image & set scale first' : 'Finish setting scale'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Custom Item Section */}
      <div className="toolbar-section custom-items-section">
        <div className="defaults-toggler">
          <span>Create Custom Item</span>
        </div>
        
        <div>
          {/* Add New Custom Furniture Form */}
          <div className="add-custom-form">
            <input
              type="text"
              placeholder="Name (e.g. My Couch)"
              value={newFurnitureName}
              onChange={(e) => setNewFurnitureName(e.target.value)}
            />
            
            <div className="dimension-inputs-row">
              <input
                type="text"
                placeholder="Width (e.g. 6')"
                value={newFurnitureWidth}
                onChange={(e) => setNewFurnitureWidth(e.target.value)}
              />
              <input
                type="text"
                placeholder="Height (e.g. 3')"
                value={newFurnitureHeight}
                onChange={(e) => setNewFurnitureHeight(e.target.value)}
              />
            </div>
            
            <div className="dimension-color-row">
              <input
                type="color"
                value={newFurnitureColor}
                onChange={(e) => setNewFurnitureColor(e.target.value)}
                title="Choose furniture color"
                className="color-picker"
              />
            </div>
            
            <div className="global-toggle-row">
              <label>Available on all floorplans:</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={newFurnitureGlobal}
                  onChange={(e) => setNewFurnitureGlobal(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            
            <button
              onClick={handleAddCustomFurnitureTemplate}
              disabled={!newFurnitureName || !newFurnitureWidth || !newFurnitureHeight}
            >
              Add Custom Item
            </button>
          </div>
        </div>
      </div>

      {/* My Items Section */}
      <div className="toolbar-section my-items-section">
        <div 
          className={`defaults-toggler ${isCustomItemsCollapsed ? 'collapsed' : ''}`}
          onClick={() => setIsCustomItemsCollapsed(!isCustomItemsCollapsed)}
        >
          <span>My Items</span>
          <span className="toggle-icon">{isCustomItemsCollapsed ? '▶' : '▼'}</span>
        </div>
        
        {!isCustomItemsCollapsed && (
          <div>
            {/* Custom Items List with Add All button */}
            {customTemplates.length > 0 && (
              <>
                <div className="custom-items-header">
                  <p>{customTemplates.length} custom item{customTemplates.length !== 1 ? 's' : ''}</p>
                  <button 
                    className="add-all-button" 
                    onClick={handleAddAllCustom}
                    disabled={pixelsPerInch === null}
                  >
                    Add All
                  </button>
                </div>
                
                <div className="custom-items-container">
                <ul className="furniture-list custom-furniture-list">
                  {customTemplates.map((item) => (
                    <li key={item.id} style={{ borderLeftColor: item.color }}>
                      <div>
                        <span>{item.name}</span>
                        <div className="furniture-dimensions">{item.width}″ × {item.height}″</div>
                      </div>
                      <div className="custom-item-actions">
                        <button
                          onClick={() => handleEditCustomTemplate(item.id)}
                          className="edit-template-button"
                          title={`Edit Template${item.isGlobal ? " (Global)" : " (This plan only)"}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button 
                          onClick={() => onAddFurniture(item)}
                          disabled={pixelsPerInch === null}
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                </div>
              </>
            )}
            
            {customTemplates.length === 0 && (
              <p className="no-items-message">No custom items created yet</p>
            )}
          </div>
        )}
      </div>

      {/* Default Items Section */}
      <div className="toolbar-section default-items-section">
        {/* Default Templates Toggle */}
        <div 
          className={`defaults-toggler ${isDefaultsCollapsed ? 'collapsed' : ''}`}
          onClick={() => setIsDefaultsCollapsed(!isDefaultsCollapsed)}
        >
          <span>Default Items</span>
          <span className="toggle-icon">{isDefaultsCollapsed ? '▶' : '▼'}</span>
        </div>
        
        {/* Default Templates List */}
        {!isDefaultsCollapsed && (
          <div className="default-items-container">
          <ul className="furniture-list">
            {defaultTemplates.map((item) => {
              // Determine furniture type class
              let furnitureClass = "";
              if (item.id.includes("couch") || item.id.includes("sofa") || item.id.includes("loveseat")) {
                furnitureClass = "furniture-sofa";
              } else if (item.id.includes("chair")) {
                furnitureClass = "furniture-chair";
              } else if (item.id.includes("bed")) {
                furnitureClass = "furniture-bed";
              } else if (item.id.includes("table")) {
                furnitureClass = "furniture-table";
              } else if (item.id.includes("desk")) {
                furnitureClass = "furniture-desk";
              }
              
              return (
                <li key={item.id} className={furnitureClass} style={{ borderLeftColor: item.color }}>
                  <div>
                    <span>{item.name}</span>
                    <div className="furniture-dimensions">{item.width}″ × {item.height}″</div>
                  </div>
                  <button 
                    onClick={() => onAddFurniture(item)}
                    disabled={pixelsPerInch === null}
                  >
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
        )}
      </div>

      {/* Placed Furniture Section */}
      <div className="toolbar-section placed-items-section">
        <div className="defaults-toggler">
          <span>Placed Items</span>
        </div>
        {placedFurniture.length === 0 ? (
          <p className="no-items-message">No items placed yet</p>
        ) : (
          <div className="placed-items-container">
          <ul className="furniture-list">
            {placedFurniture.map((item) => (
              <li 
                key={item.id} 
                className={selectedFurnitureId === item.id ? 'selected' : ''}
                onClick={() => onSelectFurniture(item.id)}
                style={{ borderLeftColor: selectedFurnitureId === item.id ? '#3182ce' : item.color }}
              >
                <div className="item-name">{item.name}</div>
                <div className="item-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditModal(item.id);
                    }}
                    className="icon-button edit-button"
                    title="Edit Item"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloneFurniture(item.id);
                    }}
                    className="icon-button clone-button"
                    title="Clone Item"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFurniture(item.id);
                    }}
                    className="icon-button delete-button"
                    title="Delete Item"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          </div>
        )}
      </div>

      {/* Edit Template Modal */}
      {isEditTemplateModalOpen && editingTemplate && (
        <div className="modal-backdrop">
          <div className="edit-template-modal">
            <h3>Edit Custom Item</h3>
            
            <div className="edit-template-form">
              <div className="form-group">
                <label>Color:</label>
                <input
                  type="color"
                  value={editingTemplate.color}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    color: e.target.value
                  })}
                  className="color-picker"
                />
              </div>
              
              <div className="form-group">
                <label>Available on all floorplans:</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isGlobal}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      isGlobal: e.target.checked
                    })}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setIsEditTemplateModalOpen(false)}>
                Cancel
              </button>
              <button 
                onClick={() => handleSaveTemplateEdit(editingTemplate.id, {
                  color: editingTemplate.color,
                  isGlobal: editingTemplate.isGlobal
                })}
                className="primary-button"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Toolbar;
