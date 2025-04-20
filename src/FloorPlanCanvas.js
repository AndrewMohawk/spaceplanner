import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  const containerRef = useRef(null); // Ref for the container div
  const [imageElement, setImageElement] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 300, height: 300 }); // Initial small size
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 }); // Store original image dimensions
  const [imageScaleFactor, setImageScaleFactor] = useState(1); // How much the image is scaled to fit

  // --- Stage Size Calculation ---
  const updateStageSize = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      // Set stage size to fill container initially
      setStageSize({ width: containerWidth, height: containerHeight });
    }
  }, []); // No dependencies, relies on ref

  // Update stage size on mount and window resize
  useEffect(() => {
    updateStageSize(); // Initial size
    window.addEventListener('resize', updateStageSize);
    return () => {
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
        // Don't revoke object URL here, Konva needs it
      };
      img.onerror = () => {
        console.error("Error loading image");
        setImageElement(null);
        setImageSize({ width: 0, height: 0 });
        if (objectUrl) URL.revokeObjectURL(objectUrl); // Revoke on error
      };
    } else {
      setImageElement(null);
      setImageSize({ width: 0, height: 0 });
    }

    // Cleanup function to revoke URL when image changes or component unmounts
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [image]);

  // Calculate image scale factor whenever stage or image size changes
  useEffect(() => {
      if (imageElement && stageSize.width > 0 && stageSize.height > 0 && imageSize.width > 0) {
          const scaleX = stageSize.width / imageSize.width;
          const scaleY = stageSize.height / imageSize.height;
          // Fit the image within the stage while maintaining aspect ratio
          const newScaleFactor = Math.min(scaleX, scaleY);
          setImageScaleFactor(newScaleFactor);
      } else {
          setImageScaleFactor(1); // Default scale if no image or stage size yet
      }
  }, [imageElement, stageSize, imageSize]);

  // Calculate image dimensions on stage
  const displayedImageWidth = imageSize.width * imageScaleFactor;
  const displayedImageHeight = imageSize.height * imageScaleFactor;
  // Center the image on the stage
  const imageOffsetX = (stageSize.width - displayedImageWidth) / 2;
  const imageOffsetY = (stageSize.height - displayedImageHeight) / 2;


   // Attach transformer to selected shape
  useEffect(() => {
    if (transformerRef.current && layerRef.current && selectedFurnitureId) {
      const stage = stageRef.current;
      // Find node by ID - more reliable than class name if IDs are unique
      const selectedNode = stage.findOne('#' + selectedFurnitureId);

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
      } else {
        transformerRef.current.nodes([]);
      }
      transformerRef.current.getLayer().batchDraw();
    } else if (transformerRef.current) {
        // Explicitly clear nodes if nothing is selected
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw(); // Use optional chaining for safety
    }
  }, [selectedFurnitureId]); // Rerun when selection changes


  // --- Event Handlers ---
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;

    // Check if the click target is the stage background or the image itself
    const isBackgroundClick = e.target === stage;
    const isImageClick = e.target.hasName('floorplan-image');

    if (isBackgroundClick || isImageClick) {
       if (isSettingScale) {
            // Need to transform pointer position from stage coordinates to image coordinates
            const pos = stage.getPointerPosition();
            if (!pos) return; // Exit if pointer position is somehow null

            // Adjust for image offset and scale
            const imageX = (pos.x - imageOffsetX) / imageScaleFactor;
            const imageY = (pos.y - imageOffsetY) / imageScaleFactor;

            // Only register click if it's within the image bounds
            if (imageX >= 0 && imageX <= imageSize.width && imageY >= 0 && imageY <= imageSize.height) {
                 onSetScalePoints({ x: imageX, y: imageY }); // Pass click position relative to image
            }
       } else {
           onSelectFurniture(null); // Deselect furniture
       }
       return;
    }

    // Check if clicking a furniture item (Rect)
    // Walk up the node tree to find the Rect if a transformer handle was clicked
    let targetNode = e.target;
    while (targetNode && !(targetNode instanceof Konva.Rect) && targetNode !== stage) {
        if (targetNode.getParent() instanceof Konva.Transformer) {
            // If clicking the transformer itself, don't deselect
            return;
        }
        targetNode = targetNode.getParent();
    }

    if (targetNode instanceof Konva.Rect && targetNode.id() && !isSettingScale) {
        const id = targetNode.id();
        onSelectFurniture(id);
        // Bring transformer to top (optional, but good UX)
        transformerRef.current?.moveToTop();
        targetNode.getLayer()?.batchDraw();
    } else if (!(e.target.getParent() instanceof Konva.Transformer)) {
        // Deselect if clicking something else that isn't part of the transformer
        onSelectFurniture(null);
    }
  };

  const handleTransformEnd = (e) => {
      const node = e.target; // The shape being transformed (Rect)
      if (!node) return;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale to avoid distortion issues with transformer
      node.scaleX(1);
      node.scaleY(1);

      // Calculate new dimensions based on scale factor (in image pixel space)
      const newWidthPx = node.width() * scaleX;
      const newHeightPx = node.height() * scaleY;

      // Convert back to inches using the original image scale (pixelsPerInch)
      const newWidthInches = pixelsPerInch ? newWidthPx / pixelsPerInch : node.attrs.originalWidthInches;
      const newHeightInches = pixelsPerInch ? newHeightPx / pixelsPerInch : node.attrs.originalHeightInches;

      // Get position relative to the image's top-left corner
      const absolutePos = node.absolutePosition();
      const imageRelativeX = (absolutePos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (absolutePos.y - imageOffsetY) / imageScaleFactor;


      onFurnitureMove(node.id(), {
          x: imageRelativeX, // Position relative to image
          y: imageRelativeY, // Position relative to image
          rotation: node.rotation(),
          width: newWidthInches, // Pass dimensions in inches
          height: newHeightInches,
      });
  };

  const handleDragEnd = (e) => {
      const node = e.target;
      if (!node) return;

      // Get position relative to the image's top-left corner
      const absolutePos = node.absolutePosition();
      const imageRelativeX = (absolutePos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (absolutePos.y - imageOffsetY) / imageScaleFactor;

      onFurnitureMove(node.id(), {
          x: imageRelativeX, // Position relative to image
          y: imageRelativeY, // Position relative to image
          rotation: node.rotation(), // Rotation doesn't change on drag
          width: node.attrs.originalWidthInches, // Pass original inches width
          height: node.attrs.originalHeightInches, // Pass original inches height
      });
  };

  // Convert furniture dimensions (inches) to pixels *relative to the original image size*
  const furnitureToImagePixels = (item) => {
    if (!pixelsPerInch) return null; // Cannot draw if scale is not set
    return {
      ...item,
      // Calculate pixel dimensions based on the image scale
      imagePxWidth: item.width * pixelsPerInch,
      imagePxHeight: item.height * pixelsPerInch,
    };
  };

  // --- Rendering ---
  return (
    // Add a ref to the container div
    <div ref={containerRef} className="canvas-container">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onClick={handleStageClick}
        onTap={handleStageClick} // For touch devices
      >
        <Layer ref={layerRef}>
          {/* Background Image - Scaled and Centered */}
          {imageElement && displayedImageWidth > 0 && (
            <KonvaImage
              image={imageElement}
              x={imageOffsetX}
              y={imageOffsetY}
              width={displayedImageWidth}
              height={displayedImageHeight}
              name="floorplan-image" // Name for click detection
            />
          )}

          {/* Scale Drawing Line - Drawn relative to the scaled image */}
          {isSettingScale && scale.points.length > 0 && pixelsPerInch && (
            <Line
              // Convert points (relative to original image) to stage coordinates
              points={scale.points.flatMap(p => [
                  p.x * imageScaleFactor + imageOffsetX,
                  p.y * imageScaleFactor + imageOffsetY
              ])}
              stroke="cyan" // Brighter color
              strokeWidth={5} // Thicker line
              lineCap="round"
              lineJoin="round"
              // dash={[10, 5]} // Remove dash for solid line visibility
              listening={false} // Don't let the line interfere with clicks
            />
          )}

          {/* Furniture Items - Positioned relative to the scaled image */}
          {furniture.map((item) => {
            const itemPx = furnitureToImagePixels(item);
            if (!itemPx) return null; // Skip if scale not set

            // Calculate position and size on the stage
            const stageX = item.x * imageScaleFactor + imageOffsetX;
            const stageY = item.y * imageScaleFactor + imageOffsetY;
            const stageWidth = itemPx.imagePxWidth * imageScaleFactor;
            const stageHeight = itemPx.imagePxHeight * imageScaleFactor;

            return (
              <Rect
                key={item.id}
                id={item.id} // Use furniture id for Konva node id
                // name={item.id} // Using ID selector is often better
                x={stageX}
                y={stageY}
                width={stageWidth}
                height={stageHeight}
                rotation={item.rotation}
                offsetX={stageWidth / 2} // Set origin to center for rotation/scaling
                offsetY={stageHeight / 2}
                fill="rgba(100, 150, 255, 0.7)" // Semi-transparent blue
                stroke="black"
                strokeWidth={1 / imageScaleFactor} // Keep stroke visually consistent when scaled
                draggable={!isSettingScale && pixelsPerInch !== null} // Only draggable when not setting scale and scale is set
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
                // Store original dimensions in inches for reference on transform/drag end
                originalWidthInches={item.width}
                originalHeightInches={item.height}
                onClick={(e) => {
                    // Prevent stage click from deselecting when clicking shape
                    e.cancelBubble = true;
                    if (!isSettingScale && pixelsPerInch !== null) {
                        onSelectFurniture(item.id);
                    }
                }}
                 onTap={(e) => { // For touch devices
                    e.cancelBubble = true;
                     if (!isSettingScale && pixelsPerInch !== null) {
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
               // Limit resize dimensions if needed (consider minimum size in pixels)
               const minSize = 10;
               if (newBox.width < minSize || newBox.height < minSize) {
                 return oldBox;
               }
               return newBox;
             }}
             // Enable rotation, disable skew
             enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
             rotateEnabled={true}
             // Keep transformer border visually consistent
             borderStrokeWidth={1 / (stageRef.current?.scaleX() ?? 1)} // Adjust based on stage scale if zooming is added
             anchorStrokeWidth={1 / (stageRef.current?.scaleX() ?? 1)}
             rotateAnchorOffset={20 / (stageRef.current?.scaleX() ?? 1)}
             anchorSize={8 / (stageRef.current?.scaleX() ?? 1)}
           />
        </Layer>
      </Stage>
       {/* Status Messages - Rendered outside Stage but inside container */}
       {isSettingScale && (
           <div className="status-message info">
               Click the first point on the floor plan image for your reference line.
               {scale.points.length === 1 && " Now click the second point."}
           </div>
       )}
        {!image && (
             <div className="status-message info">
               Upload a floor plan image using the toolbar to begin.
           </div>
        )}
         {image && pixelsPerInch === null && !isSettingScale && (
             <div className="status-message info">
               Use the 'Draw Scale Line' button in the toolbar to set the scale.
           </div>
         )}
    </div>
  );
}

export default FloorPlanCanvas;
