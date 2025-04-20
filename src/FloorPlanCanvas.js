import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer } from 'react-konva';
import Konva from 'konva'; // Import Konva namespace

// Helper function to calculate distance
const getDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

function FloorPlanCanvas({
  image, // The uploaded image object
  isSettingScale,
  onSetScalePoints, // Callback when scale points are clicked
  scale, // { points: [{x,y}, {x,y}], pixelLength: number }
  pixelsPerInch, // Calculated scale factor
  furniture, // Array of furniture items { id, x, y, width, height, rotation, name } (dimensions in inches)
  onFurnitureMove, // Callback when furniture is moved/rotated: (id, { x, y, rotation, width, height })
  selectedFurnitureId, // ID of the currently selected furniture item
  onSelectFurniture, // Callback when furniture is selected: (id | null)
}) {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  const [imageElement, setImageElement] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 600, height: 400 }); // Initial size

  // Load image element when image prop changes
  useEffect(() => {
    if (image) {
      const img = new window.Image();
      img.src = URL.createObjectURL(image);
      img.onload = () => {
        setImageElement(img);
        // Adjust stage size to image size (or a scaled version if too large)
        const maxWidth = 800; // Max width for the canvas container
        const maxHeight = 600; // Max height
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height *= ratio;
        }
        if (height > maxHeight) {
           const ratio = maxHeight / height;
           height = maxHeight;
           width *= ratio;
        }
        setStageSize({ width, height });
        // Revoke object URL to free memory
        // URL.revokeObjectURL(img.src); // Keep it for Konva Image
      };
      img.onerror = () => {
        console.error("Error loading image");
        setImageElement(null);
      };

      // Cleanup function
      return () => {
          if (img.src.startsWith('blob:')) {
              URL.revokeObjectURL(img.src);
          }
      };
    } else {
      setImageElement(null);
      setStageSize({ width: 600, height: 400 }); // Reset to default if no image
    }
  }, [image]);

   // Attach transformer to selected shape
  useEffect(() => {
    if (transformerRef.current && layerRef.current) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne('.' + selectedFurnitureId); // Find node by class name (using id)

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
      } else {
        transformerRef.current.nodes([]);
      }
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedFurnitureId]);


  const handleStageClick = (e) => {
    // If clicking the stage background (not a shape)
    if (e.target === e.target.getStage() || e.target.hasName('floorplan-image')) {
       if (isSettingScale) {
            const pos = e.target.getStage().getPointerPosition();
            onSetScalePoints(pos); // Pass click position
       } else {
           onSelectFurniture(null); // Deselect furniture
       }
       return;
    }

    // If clicking a furniture item (Rect)
    const clickedShape = e.target;
    if (clickedShape instanceof Konva.Rect && !isSettingScale) {
        const id = clickedShape.id(); // Assuming id is set on the Rect
        onSelectFurniture(id);
    } else {
        // If clicking transformer or something else, potentially deselect
         // Check if the click was on the transformer itself
        const isTransformer = e.target.getParent() instanceof Konva.Transformer;
        if (!isTransformer) {
            onSelectFurniture(null);
        }
    }
  };

  const handleTransformEnd = (e) => {
      const node = e.target; // The shape being transformed (Rect)
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale to avoid distortion issues with transformer
      node.scaleX(1);
      node.scaleY(1);

      // Calculate new dimensions based on scale factor
      // Note: Konva width/height are already scaled visually during transform
      const newWidthPx = node.width() * scaleX;
      const newHeightPx = node.height() * scaleY;

      // Convert back to inches
      const newWidthInches = pixelsPerInch ? newWidthPx / pixelsPerInch : node.attrs.originalWidthInches;
      const newHeightInches = pixelsPerInch ? newHeightPx / pixelsPerInch : node.attrs.originalHeightInches;


      onFurnitureMove(node.id(), {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: newWidthInches, // Pass dimensions in inches
          height: newHeightInches,
          // Store pixel dimensions on the node if needed for next transform
          // konvaWidth: newWidthPx,
          // konvaHeight: newHeightPx,
      });
  };

  const handleDragEnd = (e) => {
      const node = e.target;
      onFurnitureMove(node.id(), {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(), // Rotation doesn't change on drag
          width: node.attrs.originalWidthInches, // Pass original inches width
          height: node.attrs.originalHeightInches, // Pass original inches height
      });
  };

  // Convert furniture dimensions (inches) to pixels
  const furnitureToPixels = (item) => {
    if (!pixelsPerInch) return null; // Cannot draw if scale is not set
    return {
      ...item,
      konvaWidth: item.width * pixelsPerInch,
      konvaHeight: item.height * pixelsPerInch,
    };
  };

  return (
    <div className="canvas-container">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onClick={handleStageClick}
        onTap={handleStageClick} // For touch devices
      >
        <Layer ref={layerRef}>
          {/* Background Image */}
          {imageElement && (
            <KonvaImage
              image={imageElement}
              width={stageSize.width}
              height={stageSize.height}
              name="floorplan-image" // Name for click detection
            />
          )}

          {/* Scale Drawing Line */}
          {isSettingScale && scale.points.length > 0 && (
            <Line
              points={scale.points.flatMap(p => [p.x, p.y])}
              stroke="red"
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              dash={[10, 5]} // Dashed line effect
            />
          )}

          {/* Furniture Items */}
          {furniture.map((item) => {
            const itemPx = furnitureToPixels(item);
            if (!itemPx) return null; // Skip if scale not set

            return (
              <Rect
                key={item.id}
                id={item.id} // Use furniture id for Konva node id
                name={item.id} // Also use as name for easier selection
                x={item.x}
                y={item.y}
                width={itemPx.konvaWidth}
                height={itemPx.konvaHeight}
                rotation={item.rotation}
                fill="rgba(100, 150, 255, 0.7)" // Semi-transparent blue
                stroke="black"
                strokeWidth={1}
                draggable={!isSettingScale} // Only draggable when not setting scale
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
                // Store original dimensions in inches for reference on transform/drag end
                originalWidthInches={item.width}
                originalHeightInches={item.height}
                onClick={(e) => {
                    // Prevent stage click from deselecting when clicking shape
                    e.cancelBubble = true;
                    if (!isSettingScale) {
                        onSelectFurniture(item.id);
                    }
                }}
                 onTap={(e) => { // For touch devices
                    e.cancelBubble = true;
                     if (!isSettingScale) {
                        onSelectFurniture(item.id);
                    }
                }}
              />
            );
          })}

           {/* Transformer for selected furniture */}
           <Transformer
             ref={transformerRef}
             boundBoxFunc={(oldBox, newBox) => {
               // Limit resize dimensions if needed
               // Example: Minimum size
               if (newBox.width < 10 || newBox.height < 10) {
                 return oldBox;
               }
               return newBox;
             }}
             // Enable rotation, disable skew
             enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
             rotateEnabled={true}
           />
        </Layer>
      </Stage>
       {isSettingScale && (
           <div className="status-message info">
               Click the first point on the floor plan for your reference line.
               {scale.points.length === 1 && " Now click the second point."}
           </div>
       )}
        {!image && (
             <div className="status-message info">
               Upload a floor plan image to begin.
           </div>
        )}
         {image && pixelsPerInch === null && !isSettingScale && (
             <div className="status-message info">
               Use the 'Draw Scale Line' button to set the scale.
           </div>
         )}
    </div>
  );
}

export default FloorPlanCanvas;
