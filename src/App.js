import React, { useState, useCallback } from 'react';
import Toolbar from './Toolbar';
import FloorPlanCanvas from './FloorPlanCanvas';
import './App.css';

// Helper function to calculate distance (between points in original image pixel space)
const getDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

function App() {
  const [floorplanImage, setFloorplanImage] = useState(null);
  const [isSettingScale, setIsSettingScale] = useState(false);
  // scaleState stores points relative to original image, and pixel distance between them
  const [scaleState, setScaleState] = useState({ points: [], pixelLength: 0 });
  // scaleInput now stores the raw string from the Toolbar input
  const [scaleInput, setScaleInput] = useState('');
  const [pixelsPerInch, setPixelsPerInch] = useState(null); // Calculated scale
  const [furniture, setFurniture] = useState([]); // { id, name, width, height, x, y, rotation }
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFloorplanImage(file);
      // Reset everything related to the previous image/scale
      setPixelsPerInch(null);
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
      setFurniture([]);
      setIsSettingScale(false);
      setSelectedFurnitureId(null);
    }
  };

  const handleSetScaleMode = () => {
    if (!floorplanImage) {
        alert("Please upload a floor plan image first.");
        return;
    }
    setIsSettingScale(true);
    // Reset scale state when entering mode
    setScaleState({ points: [], pixelLength: 0 });
    setScaleInput('');
    setPixelsPerInch(null); // Clear previous scale if re-drawing
    setSelectedFurnitureId(null); // Deselect furniture
  };

  // Receives point coordinates relative to the original image dimensions
  const handleSetScalePoints = (point) => {
    if (!isSettingScale) return;

    setScaleState(prev => {
      const newPoints = [...prev.points, point];
      if (newPoints.length === 1) {
        // Still waiting for the second point
        return { ...prev, points: newPoints };
      } else if (newPoints.length === 2) {
        // Second point clicked, calculate pixel distance
        const pixelLength = getDistance(newPoints[0], newPoints[1]);
        setIsSettingScale(false); // Turn off drawing mode automatically
        // Keep the points, store the calculated pixel length
        return { points: newPoints, pixelLength: pixelLength };
      }
      // If more than 2 points somehow, reset (shouldn't happen with current logic)
      return { points: [], pixelLength: 0 };
    });
  };

  // Update the raw string state for the controlled input in Toolbar
  const handleScaleInputChange = (event) => {
    setScaleInput(event.target.value);
  };

  // This function now receives the PARSED value in INCHES from the Toolbar
  const handleSetScaleConfirm = (realLengthInches) => {
    // We already know realLengthInches is > 0 from Toolbar's validation
    if (scaleState.pixelLength > 0) {
      // Calculate scale: pixels (on original image) per inch
      const newScale = scaleState.pixelLength / realLengthInches;
      setPixelsPerInch(newScale);
      // Clear the input field now that scale is set
      setScaleInput('');
      // Keep scaleState.points and pixelLength for potential display or reference?
      // Or clear them? Let's keep them for now.
      // setScaleState({ points: [], pixelLength: 0 });
      console.log(`Scale set: ${newScale.toFixed(2)} pixels per inch`);
    } else {
      // This case should ideally not be reached if Toolbar validates pixelLength > 0 implicitly
      alert("Could not set scale. Please draw the scale line again.");
      // Reset state if something went wrong
       setScaleState({ points: [], pixelLength: 0 });
       setScaleInput('');
    }
  };

  const handleAddFurniture = (itemTemplate) => {
    if (pixelsPerInch === null) {
      alert("Please set the scale before adding furniture.");
      return;
    }
    const newItem = {
      ...itemTemplate,
      id: `${itemTemplate.id}-${Date.now()}`, // Ensure unique ID even for defaults
      // Initial position (relative to original image, center point)
      // Place it near top-left but consider item size slightly
      x: (itemTemplate.width * pixelsPerInch / 2) + 50,
      y: (itemTemplate.height * pixelsPerInch / 2) + 50,
      rotation: 0,
    };
    setFurniture(prev => [...prev, newItem]);
  };

 // Receives updated attributes (x, y, rotation, width, height)
 // x, y are center point relative to original image
 // width, height are in inches
 const handleFurnitureMove = useCallback((id, newAttrs) => {
    setFurniture(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              x: newAttrs.x,
              y: newAttrs.y,
              rotation: newAttrs.rotation,
              // Update dimensions if they changed (from transformer)
              width: newAttrs.width ?? item.width, // Use new width if provided
              height: newAttrs.height ?? item.height, // Use new height if provided
            }
          : item
      )
    );
  }, []); // No dependencies needed if logic is self-contained

  const handleSelectFurniture = (id) => {
      if (isSettingScale) return; // Don't allow selection while setting scale
      setSelectedFurnitureId(id);
  };


  return (
    <div className="App">
      <h1>Floor Plan Furniture Arranger</h1>
      <div className="main-content">
        <Toolbar
          onImageUpload={handleImageUpload}
          onSetScaleMode={handleSetScaleMode}
          scale={scaleState} // Pass scale state object
          scaleInput={scaleInput} // Pass raw input string
          onScaleInputChange={handleScaleInputChange} // Pass setter for raw input string
          onSetScaleConfirm={handleSetScaleConfirm} // Pass confirmation handler (expects inches)
          isSettingScale={isSettingScale}
          pixelsPerInch={pixelsPerInch}
          onAddFurniture={handleAddFurniture}
        />
        <FloorPlanCanvas
          image={floorplanImage}
          isSettingScale={isSettingScale}
          onSetScalePoints={handleSetScalePoints}
          scale={scaleState} // Pass scale state object
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
