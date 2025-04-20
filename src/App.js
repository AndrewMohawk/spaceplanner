import React, { useState, useCallback, useEffect } from 'react';
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

function App() {
  const [floorplanImage, setFloorplanImage] = useState(null);
  const [floorplanImageId, setFloorplanImageId] = useState(null); // Store identifier (name|size)
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scaleState, setScaleState] = useState({ points: [], pixelLength: 0 });
  const [scaleInput, setScaleInput] = useState('');
  const [pixelsPerInch, setPixelsPerInch] = useState(null);
  const [furniture, setFurniture] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  // State to hold combined default and custom templates
  const [availableFurnitureTemplates, setAvailableFurnitureTemplates] = useState([
      ...DEFAULT_FURNITURE_TEMPLATES
  ]);
  // State to manage scale confirmation prompt
  const [pendingScaleConfirmation, setPendingScaleConfirmation] = useState(null); // { identifier: string, scale: number } | null

  // Load custom furniture templates on initial mount
  useEffect(() => {
    const loadedCustomTemplates = loadCustomFurnitureTemplates();
    // Combine defaults with loaded custom templates
    // Ensure custom templates loaded from storage don't overwrite defaults if IDs clash somehow
    // (though custom IDs should be unique with timestamps)
    setAvailableFurnitureTemplates([
        ...DEFAULT_FURNITURE_TEMPLATES,
        ...loadedCustomTemplates.map(t => ({ ...t, isDefault: false })) // Mark as not default
    ]);
  }, []);

  // Effect to show confirmation dialog when pendingScaleConfirmation is set
  useEffect(() => {
    if (pendingScaleConfirmation) {
      const { identifier, scale } = pendingScaleConfirmation;
      const imageName = identifier.split('|')[0] || 'this image'; // Extract name for prompt

      // Use window.confirm for simplicity
      const useExisting = window.confirm(
        `A scale (${scale.toFixed(2)} px/inch) was previously saved for ${imageName}. Do you want to use it?`
      );

      if (useExisting) {
        console.log(`Using existing scale for ${identifier}: ${scale}`);
        setPixelsPerInch(scale);
        // Clear scale drawing state if we accept the saved scale
        setScaleState({ points: [], pixelLength: 0 });
        setScaleInput('');
      } else {
        console.log(`User rejected existing scale for ${identifier}.`);
        // Proceed without setting scale, user needs to set it manually
        setPixelsPerInch(null);
      }
      // Clear the pending state regardless of user choice
      setPendingScaleConfirmation(null);
    }
  }, [pendingScaleConfirmation]);


  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const identifier = `${file.name}|${file.size}`;
      setFloorplanImage(file);
      setFloorplanImageId(identifier); // Store the identifier

      // Reset state *before* checking for saved scale
      setPixelsPerInch(null);
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
      setFurniture([]);
      setIsSettingScale(false);
      setSelectedFurnitureId(null);
      setPendingScaleConfirmation(null); // Clear any previous pending state

      // Check localStorage for existing scale *after* resetting
      const existingScale = getScaleForImage(identifier);
      if (existingScale !== null) {
        // Don't set scale directly, set pending state to trigger confirmation
        setPendingScaleConfirmation({ identifier, scale: existingScale });
      } else {
        // No saved scale, proceed as normal (state is already reset)
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
    setPixelsPerInch(null); // Clear previous scale if re-drawing
    setSelectedFurnitureId(null);
    setPendingScaleConfirmation(null); // Clear pending confirmation if user decides to draw
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

  // Receives parsed inches from Toolbar
  const handleSetScaleConfirm = (realLengthInches) => {
    if (scaleState.pixelLength > 0 && floorplanImageId) { // Ensure we have image ID
      const newScale = scaleState.pixelLength / realLengthInches;
      setPixelsPerInch(newScale);
      setScaleInput('');
      // Save the newly set scale to localStorage
      saveScaleForImage(floorplanImageId, newScale);
      console.log(`Scale set and saved for ${floorplanImageId}: ${newScale.toFixed(2)} px/inch`);
    } else {
      alert("Could not set scale. Please ensure an image is loaded and the scale line was drawn.");
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
    }
  };

  // Adds an instance of a furniture template (default or custom) to the canvas
  const handleAddFurniture = (itemTemplate) => {
    if (pixelsPerInch === null) {
      alert("Please set the scale before adding furniture.");
      return;
    }
    const uniqueId = `${itemTemplate.id}-${Date.now()}`;
    const newItem = {
      ...itemTemplate, // Spread template props (name, width, height)
      id: uniqueId,     // Unique instance ID
      x: (itemTemplate.width / 2) + 50 / (pixelsPerInch || 1),
      y: (itemTemplate.height / 2) + 50 / (pixelsPerInch || 1),
      rotation: 0,
      // Remove isDefault flag from the instance on the canvas
      isDefault: undefined,
    };
    // Remove isDefault property explicitly if it exists
    delete newItem.isDefault;

    setFurniture(prev => [...prev, newItem]);
    setSelectedFurnitureId(uniqueId);
  };

  // Adds a *new* custom furniture template to the available list and saves it
  const handleAddNewCustomFurnitureTemplate = (newTemplateData) => {
      // Generate a unique ID for the template itself
      const templateId = `custom-${Date.now()}`;
      const newTemplate = {
          ...newTemplateData, // Should contain name, width, height
          id: templateId,
          isDefault: false, // Mark as custom
      };

      // Update the available templates state
      const updatedTemplates = [...availableFurnitureTemplates, newTemplate];
      setAvailableFurnitureTemplates(updatedTemplates);

      // Save only the custom templates to localStorage
      const customTemplatesToSave = updatedTemplates.filter(t => !t.isDefault);
      saveCustomFurnitureTemplates(customTemplatesToSave);

      // Immediately add an instance of this new template to the canvas
      handleAddFurniture(newTemplate);
  };


 const handleFurnitureMove = useCallback((id, newAttrs) => {
    setFurniture(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...newAttrs } // Simply merge new attributes
          : item
      )
    );
 }, []);

  const handleSelectFurniture = (id) => {
      if (isSettingScale) return;
      setSelectedFurnitureId(id);
  };

  const handleDeleteFurniture = useCallback((idToDelete) => {
    setFurniture(prev => prev.filter(item => item.id !== idToDelete));
    if (selectedFurnitureId === idToDelete) {
      setSelectedFurnitureId(null);
    }
  }, [selectedFurnitureId]);

  const handleCloneFurniture = useCallback((idToClone) => {
    const itemToClone = furniture.find(item => item.id === idToClone);
    if (itemToClone && pixelsPerInch) {
      // Find the original template to get base ID prefix
      const templatePrefix = itemToClone.id.substring(0, itemToClone.id.lastIndexOf('-')) || 'clone';
      const uniqueId = `${templatePrefix}-${Date.now()}`;
      const newItem = {
        ...itemToClone, // Clone all properties including current width/height
        id: uniqueId,
        x: itemToClone.x + (20 / pixelsPerInch),
        y: itemToClone.y + (20 / pixelsPerInch),
      };
      setFurniture(prev => [...prev, newItem]);
      setSelectedFurnitureId(uniqueId);
    }
  }, [furniture, pixelsPerInch]);


  return (
    <div className="App">
      <h1>Floor Plan Furniture Arranger</h1>
      <div className="main-content">
        <Toolbar
          // Furniture Template Props
          availableFurnitureTemplates={availableFurnitureTemplates} // Pass combined list
          onAddNewCustomFurnitureTemplate={handleAddNewCustomFurnitureTemplate} // Handler to add new template type
          onAddFurniture={handleAddFurniture} // Handler to add instance to canvas

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
