import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Transformer, Circle, Group, Text } from 'react-konva';
import Konva from 'konva';

// Helper function to calculate distance
const getDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

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


function FloorPlanCanvas({
  image,
  isSettingScale,
  onSetScalePoints,
  scale,
  pixelsPerInch,
  furniture, // Now includes color/opacity
  onFurnitureMove,
  selectedFurnitureId,
  onSelectFurniture,
}) {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);
  const [imageElement, setImageElement] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 300, height: 300 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageScaleFactor, setImageScaleFactor] = useState(1);

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
        const selectedNode = stage?.findOne('#' + selectedFurnitureId);
        if (selectedNode && selectedNode instanceof Konva.Group) {
            transformer.nodes([selectedNode]);
        } else {
            transformer.nodes([]);
        }
        transformer.getLayer()?.batchDraw();
    }
  }, [selectedFurnitureId]);


  // --- Event Handlers ---
  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const target = e.target;
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
      const originalWidthInches = rectNode.attrs.originalWidthInches;
      const originalHeightInches = rectNode.attrs.originalHeightInches;
      group.scaleX(1);
      group.scaleY(1);
      const centerPos = { x: group.x(), y: group.y() };
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;
      onFurnitureMove(group.id(), {
          x: imageRelativeX,
          y: imageRelativeY,
          rotation: group.rotation(),
          width: originalWidthInches,
          height: originalHeightInches,
      });
  };

  const handleDragEnd = (e) => {
      const group = e.target;
      if (!group || !(group instanceof Konva.Group)) return;
      const centerPos = { x: group.x(), y: group.y() };
      const imageRelativeX = (centerPos.x - imageOffsetX) / imageScaleFactor;
      const imageRelativeY = (centerPos.y - imageOffsetY) / imageScaleFactor;
      const rectNode = group.findOne('Rect');
      const originalWidthInches = rectNode?.attrs?.originalWidthInches;
      const originalHeightInches = rectNode?.attrs?.originalHeightInches;
      onFurnitureMove(group.id(), {
          x: imageRelativeX,
          y: imageRelativeY,
          rotation: group.rotation(),
          width: originalWidthInches,
          height: originalHeightInches,
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
            const baseFontSize = Math.max(8, Math.min(stageWidth, stageHeight) * 0.15);
            const fontSize = baseFontSize / imageScaleFactor;
            const textPadding = 2 / imageScaleFactor;
            // Use item's color and opacity, provide defaults if missing
            const itemColor = item.color || '#AAAAAA';
            const itemOpacity = item.opacity !== undefined ? item.opacity : 0.7;

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
                  strokeWidth={selectedFurnitureId === item.id ? 3 / imageScaleFactor : 1.5 / imageScaleFactor}
                  originalWidthInches={item.width}
                  originalHeightInches={item.height}
                  listening={true}
                />
                <Text
                  text={`${item.name}\n(${formatInches(item.width)} x ${formatInches(item.height)})`} // Use potentially updated name
                  fontSize={fontSize}
                  fill="black" // Keep text black for contrast, or calculate based on fill?
                  align="center"
                  verticalAlign="middle"
                  x={-stageWidth / 2}
                  y={-stageHeight / 2}
                  width={stageWidth}
                  height={stageHeight}
                  padding={textPadding}
                  listening={false}
                  perfectDrawEnabled={false}
                  // Add item name to force update when name changes
                  itemName_={item.name}
                  width_={item.width}
                  height_={item.height}
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
             borderStrokeWidth={1.5 / (stageRef.current?.scaleX() ?? 1)}
             anchorStrokeWidth={1 / (stageRef.current?.scaleX() ?? 1)}
             rotateAnchorOffset={20 / (stageRef.current?.scaleX() ?? 1)}
             anchorSize={10 / (stageRef.current?.scaleX() ?? 1)}
             anchorFill="#ddd"
             anchorStroke="black"
             borderStroke="red"
             borderDash={[3, 3]}
           />
        </Layer>
      </Stage>
       {/* Status Messages */}
       {isSettingScale && ( <div className="status-message info"> Click the first point... {scale.points.length === 1 && " Now click the second point."} </div> )}
       {!image && ( <div className="status-message info"> Upload a floor plan image... </div> )}
       {image && pixelsPerInch === null && !isSettingScale && scale.points.length !== 2 && ( <div className="status-message info"> Use 'Draw Scale Line'... </div> )}
       {image && pixelsPerInch === null && !isSettingScale && scale.points.length === 2 && ( <div className="status-message info"> Enter the real-world length... </div> )}
    </div>
  );
}

export default FloorPlanCanvas;
