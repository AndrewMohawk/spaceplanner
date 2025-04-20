import React, { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import FloorPlanCanvas from './FloorPlanCanvas';
import EditFurnitureModal from './EditFurnitureModal'; // Import the modal
import {
    saveScaleForImage,
    getScaleForImage,
    saveCustomFurnitureTemplates,
    loadCustomFurnitureTemplates
} from './localStorageUtils';
import './App.css';

// Default furniture items (dimensions in inches) - Keep these hardcoded as the base
const DEFAULT_FURNITURE_TEMPLATES = [
  { id: 'couch-1', name: 'Sofa (3-seat)', width: 84, height: 38, isDefault: true, color: '#6496FF', opacity: 0.7 },
  { id: 'couch-2', name: 'Loveseat', width: 60, height: 38, isDefault: true, color: '#6496FF', opacity: 0.7 },
  { id: 'chair-1', name: 'Armchair', width: 35, height: 35, isDefault: true, color: '#6496FF', opacity: 0.7 },
  { id: 'bed-q', name: 'Bed (Queen)', width: 60, height: 80, isDefault: true, color: '#FFB6C1', opacity: 0.7 },
  { id: 'bed-k', name: 'Bed (King)', width: 76, height: 80, isDefault: true, color: '#FFB6C1', opacity: 0.7 },
  { id: 'desk-1', name: 'Desk', width: 48, height: 24, isDefault: true, color: '#DEB887', opacity: 0.7 },
  { id: 'table-dr', name: 'Dining Table (6)', width: 60, height: 36, isDefault: true, color: '#DEB887', opacity: 0.7 },
];


// Helper function to calculate distance (between points in original image pixel space)
const getDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Helper function to trigger JSON download using Blob and Object URL
function downloadJson(data, filename) {
  let objectUrl = null;
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
      console.error("Error creating download link:", error);
      alert("Failed to initiate download.");
  } finally {
      if (objectUrl) {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      }
  }
}


function App() {
  const [floorplanImage, setFloorplanImage] = useState(null);
  const [floorplanImageId, setFloorplanImageId] = useState(null);
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scaleState, setScaleState] = useState({ points: [], pixelLength: 0 });
  const [scaleInput, setScaleInput] = useState('');
  const [pixelsPerInch, setPixelsPerInch] = useState(null);
  const [furniture, setFurniture] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [availableFurnitureTemplates, setAvailableFurnitureTemplates] = useState([
      ...DEFAULT_FURNITURE_TEMPLATES
  ]);
  const [pendingScaleConfirmation, setPendingScaleConfirmation] = useState(null);
  const importFileRef = useRef(null);
  // State for Edit Modal
  const [editingItemId, setEditingItemId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // State for Copy/Paste
  const [copiedItemData, setCopiedItemData] = useState(null);

  // Load custom furniture templates on initial mount
  useEffect(() => {
    const loadedCustomTemplates = loadCustomFurnitureTemplates();
    // Ensure loaded templates also have default color/opacity if missing
    const customWithDefaults = loadedCustomTemplates.map(t => ({
        ...t,
        color: t.color || '#AAAAAA', // Default grey for custom
        opacity: t.opacity !== undefined ? t.opacity : 0.7,
        isDefault: false
    }));
    setAvailableFurnitureTemplates([
        ...DEFAULT_FURNITURE_TEMPLATES,
        ...customWithDefaults
    ]);
  }, []);

  // Effect to show confirmation dialog when pendingScaleConfirmation is set
  useEffect(() => {
    if (pendingScaleConfirmation) {
      const { identifier, scale } = pendingScaleConfirmation;
      const imageName = identifier.split('|')[0] || 'this image';
      const useExisting = window.confirm(
        `A scale (${scale.toFixed(2)} px/inch) was previously saved for ${imageName}. Do you want to use it?`
      );
      if (useExisting) {
        setPixelsPerInch(scale);
        setScaleState({ points: [], pixelLength: 0 });
        setScaleInput('');
      } else {
        setPixelsPerInch(null);
      }
      setPendingScaleConfirmation(null);
    }
  }, [pendingScaleConfirmation]);

  // Define handleDeleteFurniture BEFORE the useEffect that uses it
  const handleDeleteFurniture = useCallback((idToDelete) => {
    setFurniture(prev => prev.filter(item => item.id !== idToDelete));
    setSelectedFurnitureId(prevSelectedId => (prevSelectedId === idToDelete ? null : prevSelectedId));
  }, []);

  // Effect for handling keyboard delete
  useEffect(() => {
    const handleKeyDown = (event) => {
      const targetTagName = event.target.tagName;
      const isInputFocused = targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';

      // Prevent delete if modal is open
      if (isEditModalOpen) return;

      if (!isInputFocused && selectedFurnitureId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        handleDeleteFurniture(selectedFurnitureId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Add isEditModalOpen to dependencies
  }, [selectedFurnitureId, handleDeleteFurniture, isEditModalOpen]);

  // --- Copy / Paste Logic ---
  const handleCopyItem = useCallback(() => {
      if (!selectedFurnitureId) return;
      const itemToCopy = furniture.find(item => item.id === selectedFurnitureId);
      if (itemToCopy) {
          setCopiedItemData({ ...itemToCopy }); // Store a copy of the item's data
          console.log("Copied item:", itemToCopy.name);
          // Optionally provide user feedback (e.g., brief message)
      }
  }, [selectedFurnitureId, furniture]);

  const handlePasteItem = useCallback(() => {
      if (!copiedItemData || pixelsPerInch === null) return;

      // Create a new unique ID
      const templatePrefix = copiedItemData.id.substring(0, copiedItemData.id.lastIndexOf('-')) || 'paste';
      const uniqueId = `${templatePrefix}-${Date.now()}`;

      const newItem = {
          ...copiedItemData, // Copy all properties (name, w, h, color, opacity, rotation)
          id: uniqueId,
          // Offset the pasted item slightly
          x: copiedItemData.x + (20 / pixelsPerInch),
          y: copiedItemData.y + (20 / pixelsPerInch),
      };
      setFurniture(prev => [...prev, newItem]);
      setSelectedFurnitureId(uniqueId); // Select the newly pasted item
      console.log("Pasted item:", newItem.name);
  }, [copiedItemData, pixelsPerInch]);

  // Effect for handling Copy/Paste keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (event) => {
          const targetTagName = event.target.tagName;
          const isInputFocused = targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';

          // Prevent copy/paste if modal is open
          if (isEditModalOpen) return;

          // Check for Ctrl+C or Cmd+C
          if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
              if (!isInputFocused && selectedFurnitureId) {
                  event.preventDefault();
                  handleCopyItem();
              }
          }

          // Check for Ctrl+V or Cmd+V
          if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
              if (!isInputFocused && copiedItemData) {
                  event.preventDefault();
                  handlePasteItem();
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
      };
      // Add dependencies
  }, [selectedFurnitureId, copiedItemData, handleCopyItem, handlePasteItem, isEditModalOpen]);


  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const identifier = `${file.name}|${file.size}`;
      setFloorplanImage(file);
      setFloorplanImageId(identifier);
      setPixelsPerInch(null);
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
      setFurniture([]);
      setIsSettingScale(false);
      setSelectedFurnitureId(null);
      setPendingScaleConfirmation(null);
      setCopiedItemData(null); // Clear clipboard on new image

      const existingScale = getScaleForImage(identifier);
      if (existingScale !== null) {
        setPendingScaleConfirmation({ identifier, scale: existingScale });
      } else {
        console.log(`No saved scale found for ${identifier}.`);
      }
    }
  };

  const handleSetScaleMode = () => {
    if (!floorplanImage) {
        alert("Please upload a floor plan image first.");
        return;
    }
    setIsSettingScale(true);
    setScaleState({ points: [], pixelLength: 0 });
    setScaleInput('');
    setPixelsPerInch(null);
    setSelectedFurnitureId(null);
    setPendingScaleConfirmation(null);
  };

  const handleSetScalePoints = (point) => {
    if (!isSettingScale) return;
    setScaleState(prev => {
      const newPoints = [...prev.points, point];
      if (newPoints.length === 1) {
        return { ...prev, points: newPoints };
      } else if (newPoints.length === 2) {
        const pixelLength = getDistance(newPoints[0], newPoints[1]);
        setIsSettingScale(false);
        return { points: newPoints, pixelLength: pixelLength };
      }
      return { points: [], pixelLength: 0 };
    });
  };

  const handleScaleInputChange = (event) => {
    setScaleInput(event.target.value);
  };

  const handleSetScaleConfirm = (realLengthInches) => {
    if (scaleState.pixelLength > 0 && floorplanImageId) {
      const newScale = scaleState.pixelLength / realLengthInches;
      setPixelsPerInch(newScale);
      setScaleInput('');
      saveScaleForImage(floorplanImageId, newScale);
      console.log(`Scale set and saved for ${floorplanImageId}: ${newScale.toFixed(2)} px/inch`);
    } else {
      alert("Could not set scale. Please ensure an image is loaded and the scale line was drawn.");
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
    }
  };

  // Adds an instance of a furniture template
  const handleAddFurniture = (itemTemplate) => {
    if (pixelsPerInch === null) {
      alert("Please set the scale before adding furniture.");
      return;
    }
    const uniqueId = `${itemTemplate.id}-${Date.now()}`;
    const newItem = {
      // Base properties from template
      name: itemTemplate.name,
      width: itemTemplate.width,
      height: itemTemplate.height,
      // Default appearance or from template
      color: itemTemplate.color || '#AAAAAA', // Default grey if template lacks color
      opacity: itemTemplate.opacity !== undefined ? itemTemplate.opacity : 0.7,
      // Instance specific properties
      id: uniqueId,
      x: (itemTemplate.width / 2) + 50 / (pixelsPerInch || 1),
      y: (itemTemplate.height / 2) + 50 / (pixelsPerInch || 1),
      rotation: 0,
    };
    setFurniture(prev => [...prev, newItem]);
    setSelectedFurnitureId(uniqueId);
  };

  // Adds a *new* custom furniture template
  const handleAddNewCustomFurnitureTemplate = (newTemplateData) => {
      const templateId = `custom-${Date.now()}`;
      const newTemplate = {
          ...newTemplateData, // name, width, height
          id: templateId,
          color: '#AAAAAA', // Default color for new custom items
          opacity: 0.7,     // Default opacity
          isDefault: false,
      };
      const updatedTemplates = [...availableFurnitureTemplates, newTemplate];
      setAvailableFurnitureTemplates(updatedTemplates);
      const customTemplatesToSave = updatedTemplates.filter(t => !t.isDefault);
      saveCustomFurnitureTemplates(customTemplatesToSave);
      handleAddFurniture(newTemplate); // Add instance immediately
  };


 const handleFurnitureMove = useCallback((id, newAttrs) => {
    setFurniture(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...newAttrs }
          : item
      )
    );
 }, []);

  const handleSelectFurniture = (id) => {
      if (isSettingScale) return;
      setSelectedFurnitureId(id);
  };

  // handleDeleteFurniture defined above

  const handleCloneFurniture = useCallback((idToClone) => {
    const itemToClone = furniture.find(item => item.id === idToClone);
    if (itemToClone && pixelsPerInch) {
      const templatePrefix = itemToClone.id.substring(0, itemToClone.id.lastIndexOf('-')) || 'clone';
      const uniqueId = `${templatePrefix}-${Date.now()}`;
      const newItem = {
        ...itemToClone, // Clone all properties including current appearance
        id: uniqueId,
        x: itemToClone.x + (20 / pixelsPerInch),
        y: itemToClone.y + (20 / pixelsPerInch),
      };
      setFurniture(prev => [...prev, newItem]);
      setSelectedFurnitureId(uniqueId);
    }
  }, [furniture, pixelsPerInch]);

  // --- Edit Modal Handlers ---
  const handleOpenEditModal = (itemId) => {
      setEditingItemId(itemId);
      setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
      setIsEditModalOpen(false);
      setEditingItemId(null);
  };

  const handleUpdateFurnitureItem = (itemId, updatedProps) => {
      setFurniture(prev =>
          prev.map(item =>
              item.id === itemId
                  ? { ...item, ...updatedProps } // Merge updated name, color, opacity
                  : item
          )
      );
      handleCloseEditModal(); // Close modal after saving
  };

  // --- Import / Export ---
  const handleExportLayout = () => {
    if (!floorplanImageId || pixelsPerInch === null) {
        alert("Please upload an image and set the scale before exporting.");
        return;
    }
    const layoutData = {
        version: 1,
        imageId: floorplanImageId,
        pixelsPerInch: pixelsPerInch,
        furniture: furniture, // Includes color/opacity now
    };
    const filename = `${floorplanImageId.split('|')[0] || 'layout'}.floorplan.json`;
    downloadJson(layoutData, filename);
  };

  const handleImportLayout = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!importedData || typeof importedData !== 'object' || !importedData.imageId || typeof importedData.pixelsPerInch !== 'number' || !Array.isArray(importedData.furniture)) {
            throw new Error("Invalid file format.");
        }
        // Allow import only if NO image is loaded OR if the IDs match
        if (floorplanImage && importedData.imageId !== floorplanImageId) {
            const currentImageName = floorplanImageId?.split('|')[0] || 'current image';
            const importedImageName = importedData.imageId.split('|')[0] || 'imported layout';
            alert(`Import failed: Layout is for "${importedImageName}", but current image is "${currentImageName}". Upload the correct image first or clear the current image.`);
            if (importFileRef.current) importFileRef.current.value = "";
            return;
        }

        // Ensure imported items have default color/opacity if missing from older exports
        const furnitureWithDefaults = importedData.furniture.map(item => ({
            ...item,
            color: item.color || '#AAAAAA', // Default grey if missing
            opacity: item.opacity !== undefined ? item.opacity : 0.7, // Default opacity if missing
        }));

        setPixelsPerInch(importedData.pixelsPerInch);
        setFurniture(furnitureWithDefaults); // Set furniture with defaults applied
        // If importing over empty state, maybe try to load image based on ID? Complex.
        // For now, just set the ID if it wasn't set.
        if (!floorplanImageId) {
            setFloorplanImageId(importedData.imageId);
            // We still don't have the image File/URL here for the canvas!
            alert("Layout data imported, but you may need to manually upload the corresponding floor plan image.");
        }
        setSelectedFurnitureId(null); setIsSettingScale(false); setScaleState({ points: [], pixelLength: 0 });
        setScaleInput(''); setPendingScaleConfirmation(null); setCopiedItemData(null); // Clear clipboard on import
        alert("Layout imported successfully!");
      } catch (error) {
        console.error("Error importing layout:", error); alert(`Failed to import layout: ${error.message}`);
      } finally {
          if (importFileRef.current) importFileRef.current.value = "";
      }
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e); alert("Failed to read the selected file.");
        if (importFileRef.current) importFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const triggerImportFileSelect = () => {
      if (importFileRef.current) importFileRef.current.click();
  };

  // Find the item being edited for the modal
  const itemToEdit = furniture.find(item => item.id === editingItemId);

  return (
    <div className="App">
      {/* Hidden file input for import */}
      <input type="file" ref={importFileRef} onChange={handleImportLayout} accept=".json,.floorplan" style={{ display: 'none' }} aria-hidden="true" />

      <h1>Floor Plan Furniture Arranger</h1>
      <div className="main-content">
        <Toolbar
          // Furniture Template Props
          availableFurnitureTemplates={availableFurnitureTemplates}
          onAddNewCustomFurnitureTemplate={handleAddNewCustomFurnitureTemplate}
          onAddFurniture={handleAddFurniture}

          // Placed Item Props
          placedFurniture={furniture}
          selectedFurnitureId={selectedFurnitureId}
          onSelectFurniture={handleSelectFurniture}
          onDeleteFurniture={handleDeleteFurniture}
          onCloneFurniture={handleCloneFurniture}
          onOpenEditModal={handleOpenEditModal} // Pass handler to open modal

          // Image & Scale Props
          onImageUpload={handleImageUpload}
          onSetScaleMode={handleSetScaleMode}
          scale={scaleState}
          scaleInput={scaleInput}
          onScaleInputChange={handleScaleInputChange}
          onSetScaleConfirm={handleSetScaleConfirm}
          isSettingScale={isSettingScale}
          pixelsPerInch={pixelsPerInch}

          // Import / Export Handlers
          onExportLayout={handleExportLayout}
          onTriggerImport={triggerImportFileSelect}
        />
        <FloorPlanCanvas
          image={floorplanImage}
          isSettingScale={isSettingScale}
          onSetScalePoints={handleSetScalePoints}
          scale={scaleState}
          pixelsPerInch={pixelsPerInch}
          furniture={furniture} // Pass furniture with color/opacity
          onFurnitureMove={handleFurnitureMove}
          selectedFurnitureId={selectedFurnitureId}
          onSelectFurniture={handleSelectFurniture}
        />
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && itemToEdit && (
          <EditFurnitureModal
              item={itemToEdit}
              onSave={handleUpdateFurnitureItem}
              onClose={handleCloseEditModal}
          />
      )}
    </div>
  );
}

export default App;
