import React, { useState, useCallback, useEffect, useRef } from 'react'; // Added useEffect
import Toolbar from './Toolbar';
import FloorPlanCanvas from './FloorPlanCanvas';
import {
    saveScaleForImage,
    getScaleForImage,
    saveCustomFurnitureTemplates,
    loadCustomFurnitureTemplates
} from './localStorageUtils'; // Import localStorage utilities
import './App.css';

// Default furniture items (dimensions in inches) - Keep these hardcoded as the base
const DEFAULT_FURNITURE_TEMPLATES = [
  { id: 'couch-1', name: 'Sofa (3-seat)', width: 84, height: 38, isDefault: true },
  { id: 'couch-2', name: 'Loveseat', width: 60, height: 38, isDefault: true },
  { id: 'chair-1', name: 'Armchair', width: 35, height: 35, isDefault: true },
  { id: 'bed-q', name: 'Bed (Queen)', width: 60, height: 80, isDefault: true },
  { id: 'bed-k', name: 'Bed (King)', width: 76, height: 80, isDefault: true },
  { id: 'desk-1', name: 'Desk', width: 48, height: 24, isDefault: true },
  { id: 'table-dr', name: 'Dining Table (6)', width: 60, height: 36, isDefault: true },
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
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up link element

  } catch (error) {
      console.error("Error creating download link:", error);
      alert("Failed to initiate download.");
  } finally {
      // Revoke the object URL after a short delay to allow the download to start
      if (objectUrl) {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 100); // 100ms delay
      }
  }
}


function App() {
  const [floorplanImage, setFloorplanImage] = useState(null);
  const [floorplanImageId, setFloorplanImageId] = useState(null); // Store identifier (name|size)
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
  const importFileRef = useRef(null); // Ref for the hidden file input

  // Load custom furniture templates on initial mount
  useEffect(() => {
    const loadedCustomTemplates = loadCustomFurnitureTemplates();
    setAvailableFurnitureTemplates([
        ...DEFAULT_FURNITURE_TEMPLATES,
        ...loadedCustomTemplates.map(t => ({ ...t, isDefault: false }))
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

  // Effect for handling keyboard delete
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check if the event target is an input or textarea
      const targetTagName = event.target.tagName;
      const isInputFocused = targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';

      if (!isInputFocused && selectedFurnitureId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); // Prevent default browser behavior (like navigating back)
        handleDeleteFurniture(selectedFurnitureId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Add handleDeleteFurniture and selectedFurnitureId as dependencies
  }, [selectedFurnitureId, handleDeleteFurniture]);


  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const identifier = `${file.name}|${file.size}`;
      setFloorplanImage(file);
      setFloorplanImageId(identifier);

      // Reset state *before* checking for saved scale
      setPixelsPerInch(null);
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
      setFurniture([]);
      setIsSettingScale(false);
      setSelectedFurnitureId(null);
      setPendingScaleConfirmation(null);

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

  const handleAddFurniture = (itemTemplate) => {
    if (pixelsPerInch === null) {
      alert("Please set the scale before adding furniture.");
      return;
    }
    const uniqueId = `${itemTemplate.id}-${Date.now()}`;
    const newItem = {
      ...itemTemplate,
      id: uniqueId,
      x: (itemTemplate.width / 2) + 50 / (pixelsPerInch || 1),
      y: (itemTemplate.height / 2) + 50 / (pixelsPerInch || 1),
      rotation: 0,
      isDefault: undefined,
    };
    delete newItem.isDefault;
    setFurniture(prev => [...prev, newItem]);
    setSelectedFurnitureId(uniqueId);
  };

  const handleAddNewCustomFurnitureTemplate = (newTemplateData) => {
      const templateId = `custom-${Date.now()}`;
      const newTemplate = {
          ...newTemplateData,
          id: templateId,
          isDefault: false,
      };
      const updatedTemplates = [...availableFurnitureTemplates, newTemplate];
      setAvailableFurnitureTemplates(updatedTemplates);
      const customTemplatesToSave = updatedTemplates.filter(t => !t.isDefault);
      saveCustomFurnitureTemplates(customTemplatesToSave);
      handleAddFurniture(newTemplate);
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

  // Make sure handleDeleteFurniture is stable using useCallback
  const handleDeleteFurniture = useCallback((idToDelete) => {
    setFurniture(prev => prev.filter(item => item.id !== idToDelete));
    // Use functional update for setSelectedFurnitureId if it depends on previous state
    setSelectedFurnitureId(prevSelectedId => (prevSelectedId === idToDelete ? null : prevSelectedId));
  }, []); // No dependency on selectedFurnitureId needed here if using functional update

  const handleCloneFurniture = useCallback((idToClone) => {
    const itemToClone = furniture.find(item => item.id === idToClone);
    if (itemToClone && pixelsPerInch) {
      const templatePrefix = itemToClone.id.substring(0, itemToClone.id.lastIndexOf('-')) || 'clone';
      const uniqueId = `${templatePrefix}-${Date.now()}`;
      const newItem = {
        ...itemToClone,
        id: uniqueId,
        x: itemToClone.x + (20 / pixelsPerInch),
        y: itemToClone.y + (20 / pixelsPerInch),
      };
      setFurniture(prev => [...prev, newItem]);
      setSelectedFurnitureId(uniqueId);
    }
  }, [furniture, pixelsPerInch]);

  // --- Import / Export ---

  const handleExportLayout = () => {
    if (!floorplanImageId || pixelsPerInch === null) {
        alert("Please upload an image and set the scale before exporting.");
        return;
    }

    const layoutData = {
        version: 1, // Add a version number for future compatibility
        imageId: floorplanImageId,
        pixelsPerInch: pixelsPerInch,
        furniture: furniture, // Export the current furniture state
    };

    const filename = `${floorplanImageId.split('|')[0] || 'layout'}.floorplan.json`;
    downloadJson(layoutData, filename); // Use the updated download function
  };

  const handleImportLayout = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Basic validation
        if (!importedData || typeof importedData !== 'object' || !importedData.imageId || typeof importedData.pixelsPerInch !== 'number' || !Array.isArray(importedData.furniture)) {
            throw new Error("Invalid file format.");
        }

        // **Crucial Check:** Compare imported imageId with current imageId
        if (importedData.imageId !== floorplanImageId) {
            const currentImageName = floorplanImageId?.split('|')[0] || 'current image';
            const importedImageName = importedData.imageId.split('|')[0] || 'imported layout';
            alert(`Import failed: The layout file is for "${importedImageName}", but the currently loaded image is "${currentImageName}". Please load the correct image first.`);
            // Reset the file input value so the same file can be selected again if needed
            if (importFileRef.current) {
                importFileRef.current.value = "";
            }
            return;
        }

        // Restore state from imported data
        setPixelsPerInch(importedData.pixelsPerInch);
        setFurniture(importedData.furniture);

        // Reset other potentially conflicting states
        setSelectedFurnitureId(null);
        setIsSettingScale(false);
        setScaleState({ points: [], pixelLength: 0 });
        setScaleInput('');
        setPendingScaleConfirmation(null);

        alert("Layout imported successfully!");

      } catch (error) {
        console.error("Error importing layout:", error);
        alert(`Failed to import layout: ${error.message}`);
      } finally {
          // Reset the file input value so the same file can be selected again
          if (importFileRef.current) {
              importFileRef.current.value = "";
          }
      }
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        alert("Failed to read the selected file.");
        // Reset the file input value
        if (importFileRef.current) {
            importFileRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };

  // Function to trigger the hidden file input
  const triggerImportFileSelect = () => {
      if (importFileRef.current) {
          importFileRef.current.click();
      }
  };


  return (
    <div className="App">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={importFileRef}
        onChange={handleImportLayout}
        accept=".json,.floorplan" // Accept json or custom extension
        style={{ display: 'none' }}
        aria-hidden="true"
      />

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
          onTriggerImport={triggerImportFileSelect} // Pass function to trigger file input
        />
        <FloorPlanCanvas
          image={floorplanImage}
          isSettingScale={isSettingScale}
          onSetScalePoints={handleSetScalePoints}
          scale={scaleState}
          pixelsPerInch={pixelsPerInch}
          furniture={furniture}
          onFurnitureMove={handleFurnitureMove}
          selectedFurnitureId={selectedFurnitureId}
          onSelectFurniture={handleSelectFurniture}
        />
      </div>
    </div>
  );
}

export default App;
