import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer, Circle, Group, Text } from 'react-konva';
import Konva from 'konva';

// Helper function to format inches into feet/inches string
function formatInches(inches) {
    if (inches === null || inches === undefined) return '';
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round((inches % 12) * 10) / 10;
    let output = '';
    if (feet > 0) output += `${feet}'`;
    if (remainingInches > 0) {
        if (output.length > 0) output += ' ';
        output += `${remainingInches}"`;
    }
    return output || (inches === 0 ? '0"' : '');
}

const FloorPlanCanvas = forwardRef(({
  image,
  isSettingScale,
  onSetScalePoints,
  scale,
  pixelsPerInch,
  furniture, // Now includes color/opacity
  onFurnitureMove,
  selectedFurnitureId,
  onSelectFurniture,
  onSetScaleMode,
}, ref) => {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);
  const [imageElement, setImageElement] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 300, height: 300 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageScaleFactor, setImageScaleFactor] = useState(1);
  // Add state for mouse position
  const [mousePos, setMousePos] = useState(null);
  // Add zoom level state
  const [zoomLevel, setZoomLevel] = useState(1);
  // Add state for panning
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Forward the stageRef to parent components
  useImperativeHandle(ref, () => ({
    getStage: () => stageRef.current,
    findOne: (selector) => stageRef.current?.findOne(selector),
    width: () => stageRef.current?.width(),
    height: () => stageRef.current?.height(),
    // Add missing methods that App.js is trying to access
    getStageRef: () => stageRef,
    stageToImagePoint: (stagePoint) => {
      if (!stageRef.current) return { x: 0, y: 0 };
      
      // Find the image
      const floorplanImage = stageRef.current.findOne('.floorplan-image');
      if (!floorplanImage) return { x: 0, y: 0 };
      
      // Convert stage coordinates to image coordinates
      const imageX = (stagePoint.x - imageOffsetX - stagePosition.x) / imageScaleFactor;
      const imageY = (stagePoint.y - imageOffsetY - stagePosition.y) / imageScaleFactor;
      
      // Ensure coords are within image bounds
      const clampedX = Math.max(0, Math.min(imageX, imageSize.width));
      const clampedY = Math.max(0, Math.min(imageY, imageSize.height));
      
      return { x: clampedX, y: clampedY };
    }
  }));

  // --- Stage Size Calculation ---
  const updateStageSize = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth || 300;
      const containerHeight = containerRef.current.offsetHeight || 300;
      setStageSize({ width: containerWidth, height: containerHeight });
    }
  }, []);

  useEffect(() => {
    const timerId = setTimeout(updateStageSize, 0);
    window.addEventListener('resize', updateStageSize);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener('resize', updateStageSize);
    };
  }, [updateStageSize]);

  // --- Image Loading and Scaling ---
  useEffect(() => {
    let objectUrl = null; // Keep track of created object URLs
    const img = new window.Image();

    img.onload = () => {
      setImageElement(img);
      setImageSize({ width: img.width, height: img.height });
      // Revoke object URL only if it was created for a File object
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null; // Clear the tracker
      }
    };
    img.onerror = () => {
      console.error("Error loading image");
      setImageElement(null);
      setImageSize({ width: 0, height: 0 });
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl); // Clean up on error too
        objectUrl = null;
      }
    };

    if (image instanceof File) {
      // Create an object URL for the File object
      objectUrl = URL.createObjectURL(image);
      img.src = objectUrl;
    } else if (typeof image === 'string' && image) {
      // Assume it's a URL string
      img.crossOrigin = "Anonymous"; // Handle potential CORS issues if image is from another domain
      img.src = image;
    } else {
      // No valid image source
      setImageElement(null);
      setImageSize({ width: 0, height: 0 });
    }

    // Cleanup function: revoke object URL if component unmounts before onload/onerror
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [image]); // Rerun when the image prop changes

  useEffect(() => {
      if (imageElement && stageSize.width > 0 && stageSize.height > 0 && imageSize.width > 0) {
          const scaleX = stageSize.width / imageSize.width;
          const scaleY = stageSize.height / imageSize.height;
          const newScaleFactor = Math.min(scaleX, scaleY) * zoomLevel;
          setImageScaleFactor(newScaleFactor);
      } else {
          setImageScaleFactor(1 * zoomLevel);
      }
  }, [imageElement, stageSize, imageSize, zoomLevel]);

  // Reset stage position when zoom level changes to 1
  useEffect(() => {
    if (zoomLevel === 1) {
      setStagePosition({ x: 0, y: 0 });
    }
  }, [zoomLevel]);

  const displayedImageWidth = imageSize.width * imageScaleFactor;
  const displayedImageHeight = imageSize.height * imageScaleFactor;
  const imageOffsetX = (stageSize.width - displayedImageWidth) / 2;
  const imageOffsetY = (stageSize.height - displayedImageHeight) / 2;

   // --- Transformer Logic ---
  useEffect(() => {
    if (transformerRef.current) {
        const transformer = transformerRef.current;
        const stage = transformer.getStage();
        const selectedNode = stage?.findOne('#' + selectedFurnitureId);
        if (selectedNode && selectedNode instanceof Konva.Group) {
            transformer.nodes([selectedNode]);
        } else {
            transformer.nodes([]);
        }
        transformer.getLayer()?.batchDraw();
    }
  }, [selectedFurnitureId]);

  // Add mouse move handler for scale line drawing
  const handleMouseMove = useCallback((e) => {
    if (!isSettingScale || scale.points.length !== 1) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    // Adjust for stage position when calculating image coordinates
    const imageX = (pos.x - imageOffsetX - stagePosition.x) / imageScaleFactor;
    const imageY = (pos.y - imageOffsetY - stagePosition.y) / imageScaleFactor;
    
    // Clamp to image boundaries
    const clampedX = Math.max(0, Math.min(imageX, imageSize.width));
    const clampedY = Math.max(0, Math.min(imageY, imageSize.height));
    
    setMousePos({ x: clampedX, y: clampedY });
  }, [isSettingScale, scale.points, imageOffsetX, imageOffsetY, imageScaleFactor, imageSize.width, imageSize.height, stagePosition]);

  // Handle wheel zoom
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    
    if (isSettingScale) return; // Don't zoom during scale setting
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const oldZoom = zoomLevel;
    const scaleBy = 1.05;
    
    // Get pointer position relative to the stage
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    // Calculate new zoom level
    const newZoom = e.evt.deltaY < 0 ? oldZoom * scaleBy : oldZoom / scaleBy;
    
    // Limit zoom range
    const limitedZoom = Math.max(0.5, Math.min(5, newZoom));
    
    // If zoom level is changing, calculate the new stage position
    if (limitedZoom !== oldZoom) {
      // Convert pointer position to coordinate in the original scale
      const pointTo = {
        x: (pointer.x - stagePosition.x) / oldZoom,
        y: (pointer.y - stagePosition.y) / oldZoom
      };
      
      // Calculate new position that keeps the point under mouse
      const newPos = {
        x: pointer.x - pointTo.x * limitedZoom,
        y: pointer.y - pointTo.y * limitedZoom
      };
      
      setStagePosition(newPos);
      setZoomLevel(limitedZoom);
    }
  }, [zoomLevel, isSettingScale, stagePosition]);

  // Use Konva's built-in dragging for the stage instead of custom drag logic
  const handleStageDragStart = useCallback(() => {
    // Allow dragging regardless of zoom level
    // Skip only when setting scale
    if (isSettingScale) {
      return false; // Prevent drag while setting scale
    }
    setIsDragging(true);
    return true; // Allow drag
  }, [isSettingScale]);

  const handleStageDragMove = useCallback(() => {
    // Skip only when setting scale
    if (isSettingScale) {
      return;
    }
    
    // Update our state to match Konva's internal dragging
    if (stageRef.current) {
      setStagePosition({
        x: stageRef.current.x(),
        y: stageRef.current.y()
      });
    }
  }, [isSettingScale]);

  const handleStageDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // --- Event Handlers ---
  const handleStageClick = (e) => {
    // Don't process clicks when we're finished dragging
    // Konva triggers click events after drag events, so we need to check
    // if the click is actually part of a drag operation
    if (isDragging || e.evt.button !== 0) {
      // Only handle left mouse button clicks
      return;
    }
    
    const stage = e.target.getStage();
    if (!stage) return;
    const target = e.target;
    if (target === stage || target.hasName('floorplan-image') || target === layerRef.current) {
       if (isSettingScale) {
            const pos = stage.getPointerPosition();
            if (!pos) return;
            // Adjust for stage position when calculating image coordinates
            const imageX = (pos.x - imageOffsetX - stagePosition.x) / imageScaleFactor;
            const imageY = (pos.y - imageOffsetY - stagePosition.y) / imageScaleFactor;
            const tolerance = 1 / imageScaleFactor;
            if (imageX >= -tolerance && imageX <= imageSize.width + tolerance &&
                imageY >= -tolerance && imageY <= imageSize.height + tolerance)
            {
                 const clampedX = Math.max(0, Math.min(imageX, imageSize.width));
                 const clampedY = Math.max(0, Math.min(imageY, imageSize.height));
                 onSetScalePoints({ x: clampedX, y: clampedY });
            }
       } else {
           onSelectFurniture(null);
       }
       return;
    }
    let group = target;
    while (group && !(group instanceof Konva.Group) && !(group instanceof Konva.Transformer) && group !== stage) {
        group = group.getParent();
    }
    if (group instanceof Konva.Transformer) return;
    if (group instanceof Konva.Group && group.id() && !isSettingScale) {
        onSelectFurniture(group.id());
    } else {
        onSelectFurniture(null);
    }
  };

  const handleTransformEnd = (e) => {
      const group = e.target;
      if (!group || !(group instanceof Konva.Group) || !pixelsPerInch) return;
      const rectNode = group.findOne('Rect');
      if (!rectNode) return;
      const originalWidth = rectNode.attrs.originalWidthInches;
      const originalHeight = rectNode.attrs.originalHeightInches;
      group.scaleX(1);
      group.scaleY(1);
      const centerPos = { x: group.x(), y: group.y() };
      
      // Calculate position relative to the unpanned stage/image
      // The Stage component handles the stagePosition offset
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;
      
      onFurnitureMove(group.id(), {
          x: imageRelativeX,
          y: imageRelativeY,
          rotation: group.rotation(),
          width: originalWidth,
          height: originalHeight,
      });
  };

  const handleDragEnd = (e) => {
      const group = e.target;
      if (!group || !(group instanceof Konva.Group)) return;
      const centerPos = { x: group.x(), y: group.y() };
      
      // Calculate position relative to the unpanned stage/image
      // The Stage component handles the stagePosition offset
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;
      
      const rectNode = group.findOne('Rect');
      const originalWidth = rectNode?.attrs?.originalWidthInches;
      const originalHeight = rectNode?.attrs?.originalHeightInches;
      onFurnitureMove(group.id(), {
          x: imageRelativeX,
          y: imageRelativeY,
          rotation: group.rotation(),
          width: originalWidth,
          height: originalHeight,
      });
  };

  const furnitureToImagePixels = (item) => {
    if (!pixelsPerInch) return null;
    return {
      ...item,
      imagePxWidth: item.width * pixelsPerInch,
      imagePxHeight: item.height * pixelsPerInch,
    };
  };

  const imageToStagePoint = (point) => {
      if (!point) return { x: 0, y: 0 };
      
      // Get current image position and scale
      if (!imageElement) {
        console.log('imageToStagePoint: No image element, using stage center');
        return { x: stageSize.width / 2, y: stageSize.height / 2 };
      }
      
      // Convert image coordinates to stage coordinates
      // The Stage component's x/y props handle the stagePosition offset, so we don't add it here
      const stageX = point.x * imageScaleFactor + imageOffsetX;
      const stageY = point.y * imageScaleFactor + imageOffsetY;
      
      // Ensure coordinates are valid
      if (isNaN(stageX) || isNaN(stageY)) {
        console.error('Invalid stage coordinates calculated:', { stageX, stageY, point });
        return { x: stageSize.width / 2, y: stageSize.height / 2 };
      }
      
      return {
          x: stageX,
          y: stageY
      };
  };

  // Determine if stage should display hand cursor for panning
  // Allow panning at any zoom level
  const canPan = !isSettingScale;

  // --- Rendering ---
  return (
    <div ref={containerRef} className="canvas-container">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={(e) => {
          handleMouseMove(e);
          if (isDragging) {
            handleStageDragMove();
          }
        }}
        onWheel={handleWheel}
        x={stagePosition.x}
        y={stagePosition.y}
        draggable={canPan}
        onDragStart={handleStageDragStart}
        onDragMove={handleStageDragMove}
        onDragEnd={handleStageDragEnd}
        style={{ 
          cursor: canPan ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      >
        <Layer ref={layerRef}>
          {/* Background Image */}
          {imageElement && displayedImageWidth > 0 && (
            <KonvaImage
              image={imageElement} // KonvaImage handles the loaded Image object
              x={imageOffsetX}
              y={imageOffsetY}
              width={displayedImageWidth}
              height={displayedImageHeight}
              name="floorplan-image"
              listening={isSettingScale || selectedFurnitureId === null}
            />
          )}

          {/* Scale Drawing Visuals */}
          {((isSettingScale && scale.points.length > 0) || (scale.points.length === 2 && pixelsPerInch === null)) &&
            scale.points.map((point, index) => {
              const stagePoint = imageToStagePoint(point);
              return (
                  <Circle key={`scale-point-${index}`} x={stagePoint.x} y={stagePoint.y} radius={6} fill="red" stroke="black" strokeWidth={1} listening={false} />
              );
          })}
          {/* Line between scale points */}
          {scale.points.length === 2 && pixelsPerInch === null && (
            <Line
              points={scale.points.flatMap(p => { const sp = imageToStagePoint(p); return [sp.x, sp.y]; })}
              stroke="cyan" strokeWidth={5} lineCap="round" lineJoin="round" listening={false}
            />
          )}
          
          {/* Dynamic line from first point to mouse cursor */}
          {isSettingScale && scale.points.length === 1 && mousePos && (
            <Line
              points={[
                imageToStagePoint(scale.points[0]).x,
                imageToStagePoint(scale.points[0]).y,
                imageToStagePoint(mousePos).x,
                imageToStagePoint(mousePos).y
              ]}
              stroke="cyan" 
              strokeWidth={5} 
              lineCap="round" 
              lineJoin="round" 
              dash={[5, 5]}
              listening={false}
            />
          )}

          {console.log('Rendering furniture:', furniture)}

          {/* Furniture Items - Rendered as Groups */}
          {furniture.map((item) => {
            console.log('Processing furniture item:', item);
            
            const itemPx = furnitureToImagePixels(item);
            if (!itemPx) {
              console.log('Skipping item due to missing pixelsPerInch:', item);
              return null;
            }

            // Convert item position from image to stage coordinates
            const stageCenter = imageToStagePoint({ x: item.x, y: item.y });
            console.log('Item stage center:', stageCenter);
            
            const stageWidth = itemPx.imagePxWidth * imageScaleFactor;
            const stageHeight = itemPx.imagePxHeight * imageScaleFactor;
            console.log('Item stage dimensions:', stageWidth, stageHeight);
            
            // Calculate much larger font size - 20-35% of the smallest dimension
            // This ensures text is always readable regardless of furniture size
            const smallestDimension = Math.min(stageWidth, stageHeight);
            // Use a smaller font size that allows for better wrapping
            const fontSize = Math.max(9, Math.min(smallestDimension * 0.18, 16)); 
            
            // Text styling for better visibility
            const textPadding = 4;
            // Use item's color and opacity, provide defaults if missing
            const itemColor = item.color || '#AAAAAA';
            const itemOpacity = item.opacity !== undefined ? item.opacity : 0.7;

            // Get the full text label
            const fullLabel = item.name;
            
            // Estimate number of lines based on text length and width
            // Rough estimate: 1 character takes ~fontSize*0.6 width
            const estimatedCharsPerLine = Math.max(1, Math.floor((stageWidth - 8) / (fontSize * 0.6)));
            const estimatedLines = Math.max(1, Math.ceil(fullLabel.length / estimatedCharsPerLine));
            
            // Calculate text background height to accommodate all lines
            const textBackgroundHeight = Math.max(
              fontSize + textPadding * 2,  // Minimum height
              (fontSize * estimatedLines) + textPadding * 2  // Height for all lines
            );
            
            return (
              <Group
                key={item.id}
                id={item.id}
                x={stageCenter.x}
                y={stageCenter.y}
                rotation={item.rotation}
                draggable={!isSettingScale && pixelsPerInch !== null}
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
                offsetX={0}
                offsetY={0}
              >
                <Rect
                  name="furniture-rect"
                  x={-stageWidth / 2}
                  y={-stageHeight / 2}
                  width={stageWidth}
                  height={stageHeight}
                  fill={itemColor} // Use item's color
                  opacity={itemOpacity} // Use item's opacity
                  stroke={selectedFurnitureId === item.id ? 'red' : 'black'}
                  // Use a fixed stroke width independent of scale
                  strokeWidth={selectedFurnitureId === item.id ? 2 : 1}
                  originalWidthInches={item.width}
                  originalHeightInches={item.height}
                  listening={true}
                  cornerRadius={2} // Add a slight corner radius for better appearance
                />
                
                {/* White background for text - sized to accommodate wrapped text */}
                <Rect
                  x={-stageWidth / 2 + 2}
                  y={-stageHeight / 2 + 2}
                  width={stageWidth - 4}
                  height={textBackgroundHeight}
                  fill="white"
                  opacity={0.85}
                  cornerRadius={2}
                  listening={false}
                />
                
                <Text
                  text={fullLabel}
                  fontSize={fontSize}
                  fontStyle="bold"
                  fill="#000000" 
                  align="center"
                  verticalAlign="middle"
                  x={-stageWidth / 2 + 2}
                  y={-stageHeight / 2 + 2} // Position at top with small margin
                  width={stageWidth - 4}
                  height={textBackgroundHeight}
                  padding={textPadding}
                  listening={false}
                  perfectDrawEnabled={false}
                  // Force update when properties change
                  itemName_={item.name}
                  width_={item.width}
                  height_={item.height}
                  // Use wrapping instead of ellipsis
                  ellipsis={false}
                  wrap="word"
                />
              </Group>
            );
          })}

           {/* Transformer - Attaches to the selected Group */}
           <Transformer
             ref={transformerRef}
             boundBoxFunc={(oldBox, newBox) => {
               const minSize = 10;
               if (Math.abs(newBox.width) < minSize || Math.abs(newBox.height) < minSize) {
                   return oldBox;
               }
               return newBox;
             }}
             enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
             rotateEnabled={true}
             rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
             rotationSnapTolerance={10}
             // Use fixed pixel values for Transformer elements
             borderStrokeWidth={1.5}
             anchorStrokeWidth={1}
             rotateAnchorOffset={20}
             anchorSize={10}
             anchorFill="#ddd"
             anchorStroke="black"
             borderStroke="red"
             borderDash={[3, 3]}
           />
        </Layer>
      </Stage>
      
      {/* Zoom Controls with Reset Pan button */}
      <div className="zoom-controls">
        <button 
          className="zoom-button zoom-in" 
          onClick={() => setZoomLevel(prev => Math.min(5, prev * 1.2))}
          title="Zoom In"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>
        <button 
          className="zoom-button zoom-out" 
          onClick={() => setZoomLevel(prev => Math.max(0.5, prev / 1.2))}
          title="Zoom Out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>
        <button 
          className="zoom-button zoom-reset" 
          onClick={() => {
            setZoomLevel(1);
            setStagePosition({ x: 0, y: 0 });
          }}
          title="Center & Reset Zoom"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 16l4-4 4 4"></path>
            <path d="M16 8l-4 4-4-4"></path>
          </svg>
        </button>
      </div>
      
       {/* Status Messages */}
       {isSettingScale && ( <div className="status-message info"> Click the first point... {scale.points.length === 1 && " Now click the second point."} </div> )}
       {!image && ( 
        <div className="status-message info">
          Upload a floor plan image...
        </div> 
      )}
       {image && pixelsPerInch === null && !isSettingScale && scale.points.length !== 2 && ( <div className="status-message info"> Configure scale to begin... </div> )}
       {image && pixelsPerInch === null && !isSettingScale && scale.points.length === 2 && ( <div className="status-message info"> Enter the real-world length... </div> )}
       
       {/* Pan Instructions when in normal mode */}
       {!isSettingScale && (
         <div className="status-message info">
           Click and drag to pan the view
         </div>
       )}
       
       {/* Scale Information Display - Bottom Right */}
       {pixelsPerInch !== null && (
         <div className="scale-info-display">
           <div className="scale-value">{pixelsPerInch.toFixed(2)} pixels/inch</div>
           <button 
             className="reset-scale-button"
             onClick={onSetScaleMode}
             title="Reset Scale"
           >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M3 2v6h6"></path>
               <path d="M3 8L12 17l9-9"></path>
               <path d="M21 12v6h-6"></path>
             </svg>
             Reset
           </button>
         </div>
       )}
    </div>
  );
});

export default FloorPlanCanvas;
