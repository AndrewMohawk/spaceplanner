import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer, Circle } from 'react-konva'; // Added Circle
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
      // Ensure container has non-zero dimensions before setting state
      const containerWidth = containerRef.current.offsetWidth || 300; // Fallback width
      const containerHeight = containerRef.current.offsetHeight || 300; // Fallback height
      setStageSize({ width: containerWidth, height: containerHeight });
    }
  }, []); // No dependencies, relies on ref

  // Update stage size on mount and window resize
  useEffect(() => {
    // Run initial size calculation slightly delayed to ensure layout is stable
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
          // Calculate scale needed to fit width and height
          const scaleX = stageSize.width / imageSize.width;
          const scaleY = stageSize.height / imageSize.height;
          // Use the smaller scale factor to ensure the whole image fits ("contain")
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
      const selectedNode = stage?.findOne('#' + selectedFurnitureId); // Use optional chaining

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
      } else {
        transformerRef.current.nodes([]);
      }
      transformerRef.current.getLayer()?.batchDraw(); // Use optional chaining
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
    // Sometimes clicks register on the layer instead of stage/image
    const isLayerClick = e.target === layerRef.current;
    const isImageClick = e.target.hasName('floorplan-image');

    if (isBackgroundClick || isImageClick || isLayerClick) {
       if (isSettingScale) {
            // Need to transform pointer position from stage coordinates to image coordinates
            const pos = stage.getPointerPosition();
            if (!pos) return; // Exit if pointer position is somehow null

            // Adjust for image offset and scale to get coordinates relative to the original image
            const imageX = (pos.x - imageOffsetX) / imageScaleFactor;
            const imageY = (pos.y - imageOffsetY) / imageScaleFactor;

            // Only register click if it's within the image bounds (allow slight tolerance)
            const tolerance = 1 / imageScaleFactor; // 1 pixel tolerance on screen
            if (imageX >= -tolerance && imageX <= imageSize.width + tolerance &&
                imageY >= -tolerance && imageY <= imageSize.height + tolerance)
            {
                 // Clamp coordinates to be strictly within 0 to image dimensions
                 const clampedX = Math.max(0, Math.min(imageX, imageSize.width));
                 const clampedY = Math.max(0, Math.min(imageY, imageSize.height));
                 onSetScalePoints({ x: clampedX, y: clampedY }); // Pass clamped click position relative to image
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
            // If clicking the transformer itself or its handles, don't deselect
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
      if (!node || !pixelsPerInch) return; // Need scale to convert back

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale to avoid distortion issues with transformer
      node.scaleX(1);
      node.scaleY(1);

      // Calculate new dimensions based on scale factor (in stage pixel space)
      // node.width/height() are already visually scaled, multiply by the applied scale factor
      const newStageWidthPx = node.width() * scaleX;
      const newStageHeightPx = node.height() * scaleY;

      // Convert stage pixel dimensions back to original image pixel dimensions
      const newImagePxWidth = newStageWidthPx / imageScaleFactor;
      const newImagePxHeight = newStageHeightPx / imageScaleFactor;

      // Convert image pixel dimensions back to inches
      const newWidthInches = newImagePxWidth / pixelsPerInch;
      const newHeightInches = newImagePxHeight / pixelsPerInch;

      // Get position relative to the image's top-left corner
      // Need the node's center position AFTER transform, relative to stage origin
      const centerPos = {
          x: node.x(),
          y: node.y(),
      };
      // Convert stage center position to image relative position
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;


      onFurnitureMove(node.id(), {
          x: imageRelativeX, // Center position relative to image
          y: imageRelativeY, // Center position relative to image
          rotation: node.rotation(),
          width: newWidthInches, // Pass dimensions in inches
          height: newHeightInches,
      });
  };

  const handleDragEnd = (e) => {
      const node = e.target;
      if (!node) return;

      // Get position relative to the image's top-left corner
      // Node x/y is already the center due to offsetX/Y
      const centerPos = { x: node.x(), y: node.y() };
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;

      onFurnitureMove(node.id(), {
          x: imageRelativeX, // Center position relative to image
          y: imageRelativeY, // Center position relative to image
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

  // Helper to convert image point to stage point
  const imageToStagePoint = (point) => {
      if (!point) return { x: 0, y: 0 };
      return {
          x: point.x * imageScaleFactor + imageOffsetX,
          y: point.y * imageScaleFactor + imageOffsetY
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
              listening={isSettingScale || selectedFurnitureId === null} // Only listen if setting scale or no furniture selected
            />
          )}

          {/* Scale Drawing Visuals */}
          {isSettingScale && scale.points.map((point, index) => {
              // Convert image point to stage point for rendering the circle marker
              const stagePoint = imageToStagePoint(point);
              return (
                  <Circle
                      key={`scale-point-${index}`}
                      x={stagePoint.x}
                      y={stagePoint.y}
                      radius={6} // Make points visible
                      fill="red"
                      stroke="black"
                      strokeWidth={1}
                      listening={false} // Don't interfere with clicks
                  />
              );
          })}
          {isSettingScale && scale.points.length === 2 && ( // Draw line only when 2 points exist
            <Line
              // Convert points (relative to original image) to stage coordinates
              points={scale.points.flatMap(p => {
                  const sp = imageToStagePoint(p);
                  return [sp.x, sp.y];
              })}
              stroke="cyan" // Brighter color
              strokeWidth={5} // Thicker line
              lineCap="round"
              lineJoin="round"
              listening={false} // Don't let the line interfere with clicks
            />
          )}

          {/* Furniture Items - Positioned relative to the scaled image */}
          {furniture.map((item) => {
            const itemPx = furnitureToImagePixels(item);
            if (!itemPx) return null; // Skip if scale not set

            // Calculate position and size on the stage
            // item.x/y is the center point relative to the original image
            const stageCenter = imageToStagePoint({ x: item.x, y: item.y });
            const stageWidth = itemPx.imagePxWidth * imageScaleFactor;
            const stageHeight = itemPx.imagePxHeight * imageScaleFactor;

            return (
              <Rect
                key={item.id}
                id={item.id} // Use furniture id for Konva node id
                x={stageCenter.x} // Use calculated stage center X
                y={stageCenter.y} // Use calculated stage center Y
                width={stageWidth}
                height={stageHeight}
                rotation={item.rotation}
                offsetX={stageWidth / 2} // Set origin to center for rotation/scaling
                offsetY={stageHeight / 2}
                fill="rgba(100, 150, 255, 0.7)" // Semi-transparent blue
                stroke="black"
                strokeWidth={1.5 / imageScaleFactor} // Keep stroke visually consistent when scaled
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
               // Limit resize dimensions if needed (consider minimum size in pixels on stage)
               const minSize = 10;
               if (newBox.width < minSize || newBox.height < minSize) {
                 return oldBox;
               }
               return newBox;
             }}
             // Enable rotation, disable skew
             enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
             rotateEnabled={true}
             // Keep transformer border visually consistent (adjust based on stage scale if zooming is added later)
             borderStrokeWidth={1.5 / (stageRef.current?.scaleX() ?? 1)}
             anchorStrokeWidth={1 / (stageRef.current?.scaleX() ?? 1)}
             rotateAnchorOffset={20 / (stageRef.current?.scaleX() ?? 1)}
             anchorSize={10 / (stageRef.current?.scaleX() ?? 1)}
             anchorFill="#ddd"
             anchorStroke="black"
             borderStroke="black"
             borderDash={[3, 3]}
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
         {image && pixelsPerInch === null && !isSettingScale && scale.points.length !== 2 && ( // Show only if scale not set AND input not showing
             <div className="status-message info">
               Use the 'Draw Scale Line' button in the toolbar to set the scale.
             </div>
         )}
         {/* Message indicating scale input is ready in toolbar */}
         {image && pixelsPerInch === null && !isSettingScale && scale.points.length === 2 && (
              <div className="status-message info">
                Enter the real-world length for the drawn line in the toolbar.
              </div>
         )}
    </div>
  );
}

export default FloorPlanCanvas;
