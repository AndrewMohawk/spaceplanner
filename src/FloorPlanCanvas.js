import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer, Circle, Group, Text } from 'react-konva'; // Added Group, Text
import Konva from 'konva'; // Import Konva namespace

// Helper function to calculate distance
const getDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Helper function to format inches into feet/inches string
function formatInches(inches) {
    if (inches === null || inches === undefined) return '';
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round((inches % 12) * 10) / 10; // Round to one decimal place
    let output = '';
    if (feet > 0) {
        output += `${feet}'`;
    }
    if (remainingInches > 0) {
        if (output.length > 0) output += ' '; // Add space if feet were present
        output += `${remainingInches}"`;
    }
    // Ensure output is never empty, show 0" if inches is 0 or very small
    return output || (inches === 0 ? '0"' : '');
}


function FloorPlanCanvas({
  image, // The uploaded image object
  isSettingScale,
  onSetScalePoints, // Callback when scale points are clicked
  scale, // { points: [{x,y}, {x,y}], pixelLength: number }
  pixelsPerInch, // Calculated scale factor (null until set)
  furniture, // Array of furniture items { id, x, y, width, height, rotation, name } (dimensions in inches)
  onFurnitureMove, // Callback when furniture is moved/rotated: (id, { x, y, rotation, width, height })
  selectedFurnitureId, // ID of the currently selected furniture item
  onSelectFurniture, // Callback when furniture is selected: (id | null)
}) {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null); // Ref for the container div
  const [imageElement, setImageElement] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 300, height: 300 }); // Initial small size
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 }); // Store original image dimensions
  const [imageScaleFactor, setImageScaleFactor] = useState(1); // How much the image is scaled to fit

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
    let objectUrl = null;
    if (image) {
      const img = new window.Image();
      objectUrl = URL.createObjectURL(image);
      img.src = objectUrl;
      img.onload = () => {
        setImageElement(img);
        setImageSize({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        console.error("Error loading image");
        setImageElement(null);
        setImageSize({ width: 0, height: 0 });
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    } else {
      setImageElement(null);
      setImageSize({ width: 0, height: 0 });
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  useEffect(() => {
      if (imageElement && stageSize.width > 0 && stageSize.height > 0 && imageSize.width > 0) {
          const scaleX = stageSize.width / imageSize.width;
          const scaleY = stageSize.height / imageSize.height;
          const newScaleFactor = Math.min(scaleX, scaleY);
          setImageScaleFactor(newScaleFactor);
      } else {
          setImageScaleFactor(1);
      }
  }, [imageElement, stageSize, imageSize]);

  const displayedImageWidth = imageSize.width * imageScaleFactor;
  const displayedImageHeight = imageSize.height * imageScaleFactor;
  const imageOffsetX = (stageSize.width - displayedImageWidth) / 2;
  const imageOffsetY = (stageSize.height - displayedImageHeight) / 2;

   // --- Transformer Logic ---
  useEffect(() => {
    if (transformerRef.current) {
        const transformer = transformerRef.current;
        const stage = transformer.getStage();
        // Find the GROUP by ID now
        const selectedNode = stage?.findOne('#' + selectedFurnitureId);

        if (selectedNode && selectedNode instanceof Konva.Group) {
            transformer.nodes([selectedNode]); // Attach transformer to the Group
        } else {
            transformer.nodes([]); // No group selected or found
        }
        transformer.getLayer()?.batchDraw();
    }
  }, [selectedFurnitureId]); // Rerun when selection changes


  // --- Event Handlers ---
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const target = e.target;

    // If click is on background or image
    if (target === stage || target.hasName('floorplan-image') || target === layerRef.current) {
       if (isSettingScale) {
            const pos = stage.getPointerPosition();
            if (!pos) return;
            const imageX = (pos.x - imageOffsetX) / imageScaleFactor;
            const imageY = (pos.y - imageOffsetY) / imageScaleFactor;
            const tolerance = 1 / imageScaleFactor;
            if (imageX >= -tolerance && imageX <= imageSize.width + tolerance &&
                imageY >= -tolerance && imageY <= imageSize.height + tolerance)
            {
                 const clampedX = Math.max(0, Math.min(imageX, imageSize.width));
                 const clampedY = Math.max(0, Math.min(imageY, imageSize.height));
                 onSetScalePoints({ x: clampedX, y: clampedY });
            }
       } else {
           onSelectFurniture(null); // Deselect furniture
       }
       return;
    }

    // If click is on a furniture group or its children (Rect, Text)
    let group = target;
    // Walk up to find the Group, unless we clicked the transformer itself
    while (group && !(group instanceof Konva.Group) && !(group instanceof Konva.Transformer) && group !== stage) {
        group = group.getParent();
    }

    // If we clicked the transformer, do nothing (don't select/deselect)
    if (group instanceof Konva.Transformer) {
        return;
    }

    // If we found a group and are not setting scale, select it
    if (group instanceof Konva.Group && group.id() && !isSettingScale) {
        onSelectFurniture(group.id()); // Select the group
    } else {
        // Otherwise (e.g., clicked something else), deselect
        onSelectFurniture(null);
    }
  };

  // Transform End handler - Operates on the Group
  const handleTransformEnd = (e) => {
      const group = e.target; // This is the Group node
      if (!group || !(group instanceof Konva.Group) || !pixelsPerInch) return;

      const scaleX = group.scaleX();
      const scaleY = group.scaleY();

      // Find the Rect inside to get its base size (before scaling)
      const rectNode = group.findOne('Rect');
      if (!rectNode) return; // Should not happen

      // Original stage dimensions of the rect (before this transform)
      const originalStageWidth = rectNode.width();
      const originalStageHeight = rectNode.height();

      // Calculate new dimensions based on group's scale factor
      const newStageWidthPx = originalStageWidth * scaleX;
      const newStageHeightPx = originalStageHeight * scaleY;

      // Convert stage pixel dimensions back to original image pixel dimensions
      const newImagePxWidth = newStageWidthPx / imageScaleFactor;
      const newImagePxHeight = newStageHeightPx / imageScaleFactor;

      // Convert image pixel dimensions back to inches
      const newWidthInches = newImagePxWidth / pixelsPerInch;
      const newHeightInches = newImagePxHeight / pixelsPerInch;

      // Reset group scale AFTER calculating new dimensions
      group.scaleX(1);
      group.scaleY(1);

      // Position comes from the GROUP
      const centerPos = { x: group.x(), y: group.y() };
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;

      onFurnitureMove(group.id(), { // Use group's ID
          x: imageRelativeX,
          y: imageRelativeY,
          rotation: group.rotation(), // Use group's rotation
          width: newWidthInches,
          height: newHeightInches,
      });
  };

  // Drag End handler - Operates on the Group
  const handleDragEnd = (e) => {
      const group = e.target; // The Group node
      if (!group || !(group instanceof Konva.Group)) return;

      const centerPos = { x: group.x(), y: group.y() };
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;

      // Find the Rect inside to get original dimensions (could also store on group attrs)
      const rectNode = group.findOne('Rect');
      const originalWidthInches = rectNode?.attrs?.originalWidthInches;
      const originalHeightInches = rectNode?.attrs?.originalHeightInches;

      onFurnitureMove(group.id(), {
          x: imageRelativeX,
          y: imageRelativeY,
          rotation: group.rotation(),
          width: originalWidthInches, // Pass original inches width
          height: originalHeightInches, // Pass original inches height
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
      return {
          x: point.x * imageScaleFactor + imageOffsetX,
          y: point.y * imageScaleFactor + imageOffsetY
      };
  };

  // --- Rendering ---
  return (
    <div ref={containerRef} className="canvas-container">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer ref={layerRef}>
          {/* Background Image */}
          {imageElement && displayedImageWidth > 0 && (
            <KonvaImage
              image={imageElement}
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
          {scale.points.length === 2 && pixelsPerInch === null && (
            <Line
              points={scale.points.flatMap(p => { const sp = imageToStagePoint(p); return [sp.x, sp.y]; })}
              stroke="cyan" strokeWidth={5} lineCap="round" lineJoin="round" listening={false}
            />
          )}

          {/* Furniture Items - Rendered as Groups */}
          {furniture.map((item) => {
            const itemPx = furnitureToImagePixels(item);
            if (!itemPx) return null;

            const stageCenter = imageToStagePoint({ x: item.x, y: item.y });
            const stageWidth = itemPx.imagePxWidth * imageScaleFactor;
            const stageHeight = itemPx.imagePxHeight * imageScaleFactor;
            // Dynamic font size based on the smaller dimension of the item on stage
            const baseFontSize = Math.max(8, Math.min(stageWidth, stageHeight) * 0.15);
            // Scale font size inversely with image scale factor to keep it readable
            const fontSize = baseFontSize / imageScaleFactor;
            const textPadding = 2 / imageScaleFactor; // Scale padding too

            return (
              <Group
                key={item.id}
                id={item.id} // ID on the Group for selection and transformer
                x={stageCenter.x}
                y={stageCenter.y}
                rotation={item.rotation}
                draggable={!isSettingScale && pixelsPerInch !== null}
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd} // Move transform handler to Group
                // Group offset is 0,0 - its position (x,y) is the center
                offsetX={0}
                offsetY={0}
                // Click/Tap on Group selects it
                // onClick/onTap handled by Stage click delegation logic now
              >
                <Rect
                  // No ID needed here
                  name="furniture-rect" // Add name for potential targeting
                  x={-stageWidth / 2} // Position relative to group center (0,0)
                  y={-stageHeight / 2} // Position relative to group center (0,0)
                  width={stageWidth}
                  height={stageHeight}
                  fill="rgba(100, 150, 255, 0.7)"
                  stroke={selectedFurnitureId === item.id ? 'red' : 'black'} // Highlight stroke when selected
                  strokeWidth={selectedFurnitureId === item.id ? 3 / imageScaleFactor : 1.5 / imageScaleFactor} // Thicker stroke when selected
                  // Store original dimensions for reference if needed
                  originalWidthInches={item.width}
                  originalHeightInches={item.height}
                  // Rect needs listening enabled for transformer to attach correctly via group delegation
                  listening={true}
                />
                <Text
                  text={`${item.name}\n(${formatInches(item.width)} x ${formatInches(item.height)})`}
                  fontSize={fontSize}
                  fill="black"
                  align="center"
                  verticalAlign="middle"
                  x={-stageWidth / 2} // Position relative to group center (0,0)
                  y={-stageHeight / 2} // Position relative to group center (0,0)
                  width={stageWidth}   // Text width matches rect width
                  height={stageHeight}  // Text height matches rect height
                  padding={textPadding}
                  listening={false} // Text doesn't need to be interactive
                  perfectDrawEnabled={false} // Perf optimization
                  // Ensure text updates if item dimensions change via transform
                  width_={item.width} // Add dummy prop to force update on width change
                  height_={item.height} // Add dummy prop to force update on height change
                />
              </Group>
            );
          })}

           {/* Transformer - Attaches to the selected Group */}
           <Transformer
             ref={transformerRef}
             boundBoxFunc={(oldBox, newBox) => {
               // Limit resize dimensions if needed (consider minimum size in pixels on stage)
               const minSize = 10;
               // Use absolute width/height for comparison
               if (Math.abs(newBox.width) < minSize || Math.abs(newBox.height) < minSize) {
                   return oldBox;
               }
               return newBox;
             }}
             enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
             rotateEnabled={true}
             // Keep transformer border visually consistent (adjust based on stage scale if zooming is added later)
             borderStrokeWidth={1.5 / (stageRef.current?.scaleX() ?? 1)}
             anchorStrokeWidth={1 / (stageRef.current?.scaleX() ?? 1)}
             rotateAnchorOffset={20 / (stageRef.current?.scaleX() ?? 1)}
             anchorSize={10 / (stageRef.current?.scaleX() ?? 1)}
             anchorFill="#ddd"
             anchorStroke="black"
             borderStroke="red" // Make transformer border red for visibility
             borderDash={[3, 3]}
             // Transformer does not need its own transform end handler if group handles it
             // onTransformEnd={handleTransformEnd} // REMOVED from here
           />
        </Layer>
      </Stage>
       {/* Status Messages */}
       {isSettingScale && (
           <div className="status-message info">
               Click the first point on the floor plan image for your reference line.
               {scale.points.length === 1 && " Now click the second point."}
           </div>
       )}
        {!image && ( <div className="status-message info"> Upload a floor plan image using the toolbar to begin. </div> )}
         {image && pixelsPerInch === null && !isSettingScale && scale.points.length !== 2 && ( <div className="status-message info"> Use the 'Draw Scale Line' button in the toolbar to set the scale. </div> )}
         {image && pixelsPerInch === null && !isSettingScale && scale.points.length === 2 && ( <div className="status-message info"> Enter the real-world length for the drawn line in the toolbar (e.g., 10', 5'6"). </div> )}
    </div>
  );
}

export default FloorPlanCanvas;
