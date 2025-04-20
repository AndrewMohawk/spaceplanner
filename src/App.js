import React, { useState, useCallback } from 'react';
import Toolbar from './Toolbar';
import FloorPlanCanvas from './FloorPlanCanvas';
import './App.css';

// Helper function to calculate distance
const getDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

function App() {
  const [floorplanImage, setFloorplanImage] = useState(null);
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scaleState, setScaleState] = useState({ points: [], pixelLength: 0 });
  const [scaleInput, setScaleInput] = useState(''); // User input for real-world length
  const [pixelsPerInch, setPixelsPerInch] = useState(null); // Calculated scale
  const [furniture, setFurniture] = useState([]); // { id, name, width, height, x, y, rotation }
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFloorplanImage(file);
      // Reset scale and furniture when a new image is uploaded
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
    setScaleState({ points: [], pixelLength: 0 }); // Reset points when starting
    setScaleInput('');
    setSelectedFurnitureId(null); // Deselect furniture
  };

  const handleSetScalePoints = (point) => {
    if (!isSettingScale) return;

    setScaleState(prev => {
      const newPoints = [...prev.points, point];
      if (newPoints.length === 1) {
        return { ...prev, points: newPoints };
      } else if (newPoints.length === 2) {
        const pixelLength = getDistance(newPoints[0], newPoints[1]);
        setIsSettingScale(false); // Turn off drawing mode automatically
        return { points: newPoints, pixelLength: pixelLength };
      }
      // If more than 2 points somehow, reset (or ignore)
      return { points: [], pixelLength: 0 };
    });
  };

  const handleScaleInputChange = (event) => {
    setScaleInput(event.target.value);
  };

  const handleSetScaleConfirm = () => {
    const realLength = parseFloat(scaleInput);
    if (realLength > 0 && scaleState.pixelLength > 0) {
      const newScale = scaleState.pixelLength / realLength;
      setPixelsPerInch(newScale);
      // Maybe clear the visual line after setting scale? Or keep it?
      // setScaleState({ points: [], pixelLength: 0 });
      setScaleInput(''); // Clear input after setting
      console.log(`Scale set: ${newScale.toFixed(2)} pixels per inch`);
    } else {
      alert("Please enter a valid positive length for the scale line.");
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
      x: 50, // Default position (e.g., top-left corner)
      y: 50,
      rotation: 0,
    };
    setFurniture(prev => [...prev, newItem]);
  };

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
              width: newAttrs.width ?? item.width,
              height: newAttrs.height ?? item.height,
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
          scale={scaleState}
          scaleInput={scaleInput}
          onScaleInputChange={handleScaleInputChange}
          onSetScaleConfirm={handleSetScaleConfirm}
          isSettingScale={isSettingScale}
          pixelsPerInch={pixelsPerInch}
          onAddFurniture={handleAddFurniture}
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
