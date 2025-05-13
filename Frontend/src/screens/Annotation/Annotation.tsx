import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  Menu,
  Save,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Settings,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Move,
  MousePointer,
  Pencil,
  Trash,
  Check,
  Undo,
  Redo,
  ChevronDown,
  SquareDashed
} from 'lucide-react';
import axios from 'axios';

export const Annotation = () => {
  const navigate = useNavigate();
  const { project_id, id: frame_number } = useParams();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const selectedBox = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredBox, setHoveredBox] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [allBoxesVisible, setAllBoxesVisible] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [currentTool, setCurrentTool] = useState<'select' | 'box' | 'zoomIn' | 'zoomOut' | 'move' | 'dragBox'>('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [totalImages, setTotalImages] = useState<number>(0);
  const [currentFrameNumber, setCurrentFrameNumber] = useState<number>(-1);
  const [draggedBoxId, setDraggedBoxId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [labelOptions, setLabelOptions] = useState<string[]>([]);
  const [labelColors, setLabelColors] = useState<Record<string, string>>({});
  const filteredLabelOptions = labelOptions.filter(label =>
    label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [frame_id, setFrameID] = useState<number>(-1);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; icon: JSX.Element } | null>(null);
  const showNotification = (message: string, type: 'success' | 'error', icon: JSX.Element) => {
    setNotification({ message, type, icon });
    setTimeout(() => setNotification(null), 2000);
  };
  const [checkSuccess, setCheckSuccess] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isToolboxExpanded, setIsToolboxExpanded] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [allBoxesLocked, setAllBoxesLocked] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  interface ImageDataResponse {
    image_id: number;
    image_name: string;
    yolo: string | number[][];
    finished: boolean;
    labels: string[];
    colors: string[];
    image: string;
    format?: string;
    frame_number: number;
  }

  interface Point {
    x: number;
    y: number;
  }

  interface BoundingBox {
    id: number;
    points: Point[];
    label: string;
    name: string;
    color: string;
    opacity: number;
    visible: boolean;
    locked: boolean;
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingName !== null && !(event.target as HTMLElement).closest('input')) {
        setEditingName(null);
      }
      if (openDropdown !== null && !(event.target as HTMLElement).closest('.dropdown-container')) {
        setOpenDropdown(null);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingName, openDropdown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sortedBoxes = [...boxes].sort((a, b) => {
      if (a.locked && !b.locked) return -1;
      if (!a.locked && b.locked) return 1;
      return 0;
    });

    sortedBoxes.forEach((box) => {
      if (box.visible && box.points.length === 2) {
        const [start, end] = box.points;

        const isHovered = hoveredBox === box.id;
        const boxOpacity = isHovered ? Math.min(1, opacity / 100 + 0.3) : opacity / 100;

        ctx.strokeStyle = box.color;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = `${box.color}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.fill();
        ctx.stroke();

        if (isHovered) {
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.fillText(box.name, start.x, start.y - 5);
        }

        if (hoveredBox === box.id && currentTool === 'dragBox') {
          const cornerSize = 6;
          const corners = [
            { x: start.x, y: start.y },
            { x: end.x, y: start.y },
            { x: start.x, y: end.y },
            { x: end.x, y: end.y },
          ];

          ctx.fillStyle = 'white';
          corners.forEach((corner) => {
            ctx.beginPath();
            ctx.arc(corner.x, corner.y, cornerSize / 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    });
  }, [boxes, hoveredBox, currentTool, opacity]);

  useEffect(() => {
    const fetchImageCount = async () => {
      if (!project_id) return;

      try {
        const response = await axios.get<{ total_images: number; first_image_id: number | null }>(
          `http://localhost:8000/project/${project_id}/image_count`
        );

        setTotalImages(response.data.total_images);
      } catch (error) {
        console.error("Error al obtener las imágenes", error);
      }
    };

    fetchImageCount();
  }, [project_id]);

  useEffect(() => {
    if (frame_number) {
      setCurrentFrameNumber(Number(frame_number));
    }
  }, [frame_number]);

  useEffect(() => {
    const fetchImageData = async () => {
      if (!project_id || currentFrameNumber === -1) return;

      try {
        const response = await axios.get(
          `http://localhost:8000/project/${project_id}/image/${currentFrameNumber}`
        );
        const data = response.data as ImageDataResponse;

        const imageFormat = data.format || 'jpeg';
        const imageBase64 = data.image;

        if (imageRef.current) {
          imageRef.current.src = `data:image/${imageFormat};base64,${imageBase64}`;
        }

        const labelsString = Array.isArray(data.labels) ? data.labels[0] : data.labels;
        const colorsString = Array.isArray(data.colors) ? data.colors[0] : data.colors;

        const labels: string[] = JSON.parse(labelsString);
        const colors: string[] = JSON.parse(colorsString);

        setLabelOptions(labels);

        const colorDict: Record<string, string> = {};
        labels.forEach((label, i) => {
          colorDict[label] = colors[i] || '#00ff00';
        });
        setLabelColors(colorDict);

        setFrameID(data.image_id);

        await isImageLoaded;

        let yoloParsed: number[][] = [];

        if (Array.isArray(data.yolo)) {
          yoloParsed = data.yolo;
        } else if (typeof data.yolo === 'string' && data.yolo.trim() !== '') {
          yoloParsed = data.yolo
            .trim()
            .split('\n')
            .map((line: string) => line.trim().split(' ').map(Number));
        }

        const displayWidth = imageRef.current?.clientWidth || 1;
        const displayHeight = imageRef.current?.clientHeight || 1;

        const newBoxes: BoundingBox[] = yoloParsed.map((yoloBox: number[], index: number) => {
          const [labelIdx, x_center, y_center, width, height] = yoloBox;

          const boxWidth = width * displayWidth;
          const boxHeight = height * displayHeight;
          const centerX = x_center * displayWidth;
          const centerY = y_center * displayHeight;

          const startX = centerX - boxWidth / 2;
          const startY = centerY - boxHeight / 2;
          const endX = centerX + boxWidth / 2;
          const endY = centerY + boxHeight / 2;

          const label = labels[labelIdx];
          const color = colorDict[label] || '#00ff00';

          return {
            id: Date.now() + index,
            points: [
              { x: startX, y: startY },
              { x: endX, y: endY },
            ],
            label: label,
            name: `Box ${boxes.length + index + 1}`,
            color: color,
            opacity: opacity / 100,
            visible: true,
            locked: false,
          };
        });

        if (newBoxes.length > 0) {
          setBoxes(newBoxes);
          setHasChanges(false);
        } else {
          setHasChanges(true);
        }

        setCheckSuccess(data.finished);
      } catch (err) {
        console.error(err);
      }
    };

    fetchImageData();
  }, [project_id, currentFrameNumber]);



  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    const x = rawX / zoom;
    const y = rawY / zoom;

    if (currentTool === 'box') {
      if (!isDrawing) {
        setIsDrawing(true);
        setCurrentPoints([{ x, y }]);
      } else {
        const startPoint = currentPoints[0];
        const endPoint = { x, y };

        const correctedStart = {
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y),
        };
        const correctedEnd = {
          x: Math.max(startPoint.x, endPoint.x),
          y: Math.max(startPoint.y, endPoint.y),
        };

        const defaultLabel = labelOptions[0];
        const color = labelColors[defaultLabel] || '#00ff00';

        const newBox: BoundingBox = {
          id: Date.now(),
          points: [correctedStart, correctedEnd],
          label: defaultLabel,
          name: `Box ${boxes.length + 1}`,
          color: color,
          opacity: opacity / 100,
          visible: true,
          locked: false,
        };

        setBoxes([...boxes, newBox]);
        setIsDrawing(false);
        setCurrentPoints([]);
        setHasChanges(true);
        setCheckSuccess(false);
      }
    }
  };

  const drawCrosshair = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ctx.canvas.width, y);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ctx.canvas.height);
    ctx.stroke();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setCurrentMousePosition({ x, y });

    if (isDragging) {
      if (currentTool === 'dragBox' && draggedBoxId !== null) {
        setBoxes((prevBoxes) =>
          prevBoxes.map((box) => {
            if (box.id === draggedBoxId && !box.locked) {
              const [start, end] = box.points;

              if (resizeCorner) {
                let newStart, newEnd;
              
                switch (resizeCorner) {
                  case 'top-left':
                    newStart = { x, y };
                    newEnd = { x: end.x, y: end.y };
                    break;
                  case 'top-right':
                    newStart = { x: start.x, y: y };
                    newEnd = { x, y: end.y };
                    break;
                  case 'bottom-left':
                    newStart = { x, y: start.y };
                    newEnd = { x: end.x, y };
                    break;
                  case 'bottom-right':
                    newStart = { x: start.x, y: start.y };
                    newEnd = { x, y };
                    break;
                }
              
                setHasChanges(true);
                setCheckSuccess(false);
              
                return {
                  ...box,
                  points: [newStart, newEnd],
                };
              } else {
                if (dragOffset) {
                  const newStartX = x - (dragOffset.x || 0);
                  const newStartY = y - (dragOffset.y || 0);
                  const width = end.x - start.x;
                  const height = end.y - start.y;

                  setHasChanges(true);
                  setCheckSuccess(false);

                  return {
                    ...box,
                    points: [
                      { x: newStartX, y: newStartY },
                      { x: newStartX + width, y: newStartY + height },
                    ],
                  };
                }
              }
            }
            return box;
          })
        );
      } else if (currentTool === 'move' && dragStart) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setPan((prevPan) => ({
          x: prevPan.x + deltaX / zoom,
          y: prevPan.y + deltaY / zoom,
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    } else if (!isDrawing) {
      const sortedBoxes = [...boxes].sort((a, b) => {
        if (a.locked && !b.locked) return 1;
        if (!a.locked && b.locked) return -1;
        return 0;
      });

      const hovered = sortedBoxes.find((box) => {
        const [start, end] = box.points;
        return x >= start.x && x <= end.x && y >= start.y && y <= end.y;
      });
      setHoveredBox(hovered ? hovered.id : null);
    }

    if (isDrawing) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      boxes.forEach((box) => {
        if (box.visible && box.points.length === 2) {
          const [start, end] = box.points;

          ctx.strokeStyle = box.color;
          ctx.lineWidth = 1.5;
          ctx.fillStyle = `${box.color}${Math.round(opacity * 2.55)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.beginPath();
          ctx.rect(
            start.x,
            start.y,
            (end.x - start.x),
            (end.y - start.y)
          );
          ctx.fill();
          ctx.stroke();
        }
      });

      if (currentPoints.length === 1) {
        const startPoint = currentPoints[0];
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = `#00ff00${Math.round(opacity * 2.55)
          .toString(16)
          .padStart(2, '0')}`;
        ctx.beginPath();
        ctx.rect(
          startPoint.x,
          startPoint.y,
          (x - startPoint.x),
          (y - startPoint.y)
        );
        ctx.fill();
        ctx.stroke();
      }

      drawCrosshair(ctx, x, y);
    }else if (currentTool === 'box' && !isDrawing) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      boxes.forEach((box) => {
        if (box.visible && box.points.length === 2) {
          const [start, end] = box.points;
    
          ctx.strokeStyle = box.color;
          ctx.lineWidth = 1.5;
          ctx.fillStyle = `${box.color}${Math.round(opacity * 2.55)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.beginPath();
          ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
          ctx.fill();
          ctx.stroke();
        }
      });
    
      drawCrosshair(ctx, x, y);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const sortedBoxes = [...boxes].sort((a, b) => {
      if (a.locked && !b.locked) return 1;
      if (!a.locked && b.locked) return -1;
      return 0;
    });

    if (currentTool === 'dragBox') {
      const box = sortedBoxes.find((box) => box.id === hoveredBox);
      if (box) {
        const [start, end] = box.points;
        const cornerSize = 6;
        const corners: { x: number; y: number; corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }[] = [
          { x: start.x, y: start.y, corner: 'top-left' },
          { x: end.x, y: start.y, corner: 'top-right' },
          { x: start.x, y: end.y, corner: 'bottom-left' },
          { x: end.x, y: end.y, corner: 'bottom-right' },
        ];

        const corner = corners.find(
          (corner) =>
            x >= corner.x - cornerSize / 2 &&
            x <= corner.x + cornerSize / 2 &&
            y >= corner.y - cornerSize / 2 &&
            y <= corner.y + cornerSize / 2
        );

        if (corner) {
          setDraggedBoxId(box.id);
          setDragOffset({ x: x - corner.x, y: y - corner.y });
          setIsDragging(true);
          setDragStart({ x, y });
          setResizeCorner(corner.corner);
          return;
        }

        setDraggedBoxId(box.id);
        setDragOffset({ x: x - start.x, y: y - start.y });
        setIsDragging(true);
        setResizeCorner(null);
      }
    } else if (currentTool === 'move') {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDraggedBoxId(null);
      setDragOffset(null);
      setResizeCorner(null);

      setBoxes((prevBoxes) =>
        prevBoxes.map((box) => {
          if (box.id === draggedBoxId) {
            const [p1, p2] = box.points;
            const correctedStart = {
              x: Math.min(p1.x, p2.x),
              y: Math.min(p1.y, p2.y),
            };
            const correctedEnd = {
              x: Math.max(p1.x, p2.x),
              y: Math.max(p1.y, p2.y),
            };
      
            return {
              ...box,
              points: [correctedStart, correctedEnd],
            };
          }
          return box;
        })
      );
    }
  };

  const handleDeleteBox = (id: number) => {
    setBoxes(boxes.filter(box => box.id !== id));
    setHasChanges(true);
    setCheckSuccess(false);
  };

  const toggleBoxVisibility = (id: number) => {
    setBoxes(boxes.map(box =>
      box.id === id ? { ...box, visible: !box.visible } : box
    ));
  };

  const toggleAllBoxesVisibility = () => {
    setAllBoxesVisible(!allBoxesVisible);
    setBoxes(boxes.map(box => ({ ...box, visible: !allBoxesVisible })));
  };

  const toggleBoxLock = (id: number) => {
    setBoxes((prevBoxes) =>
      prevBoxes.map((box) =>
        box.id === id ? { ...box, locked: !box.locked } : box
      )
    );
  };

  const toggleAllBoxesLock = () => {
    setAllBoxesLocked(!allBoxesLocked);
    setBoxes((prevBoxes) =>
      prevBoxes.map((box) => ({ ...box, locked: !allBoxesLocked }))
    );
  };

  const handleNameDoubleClick = (id: number) => {
    setEditingName(id);
  };

  const handleNameChange = (id: number, newName: string) => {
    setBoxes(boxes.map(box =>
      box.id === id ? { ...box, name: newName } : box
    ));
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setEditingName(null);
    }
  };

  const handleLabelChange = (id: number, newLabel: string) => {
    setBoxes(boxes.map(box =>
      box.id === id
        ? {
          ...box,
          label: newLabel,
          color: labelColors[newLabel] || '#00ff00',
        }
        : box
    ));
    setOpenDropdown(null);
    setSearchTerm('');
  };

  const getCursorStyle = () => {
    if (isDragging && currentTool === 'dragBox') {
      return 'grabbing';
    }
    if (hoveredBox !== null && currentTool === 'dragBox') {
      const box = boxes.find((box) => box.id === hoveredBox);
      if (box) {
        const [start, end] = box.points;
        const cornerSize = 6;
        const corners = [
          { x: start.x, y: start.y },
          { x: end.x, y: start.y },
          { x: start.x, y: end.y },
          { x: end.x, y: end.y },
        ];

        const isOnCorner = corners.some(
          (corner) =>
            Math.abs(corner.x - currentMousePosition.x) <= cornerSize / 2 &&
            Math.abs(corner.y - currentMousePosition.y) <= cornerSize / 2
        );

        if (isOnCorner) {
          return 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLW1vdmUtZGlhZ29uYWwtaWNvbiBsdWNpZGUtbW92ZS1kaWFnb25hbCI+PHBhdGggZD0iTTExIDE5SDV2LTYiLz48cGF0aCBkPSJNMTMgNWg2djYiLz48cGF0aCBkPSJNMTkgNSA1IDE5Ii8+PC9zdmc+") 12 12, auto';
        }
      }
      return 'grab';
    }
    switch (currentTool) {
      case 'box':
        return 'crosshair';
      case 'zoomIn':
        return 'zoom-in';
      case 'zoomOut':
        return 'zoom-out';
      case 'move':
        return 'move';
      case 'select':
        return 'pointer';
      default:
        return 'default';
    }
  };

  const handleZoomIn = () => {
    setZoom((prevZoom) => Math.min(prevZoom + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleSaveAnnotations = async (finished: boolean) => {
    if (!project_id || currentFrameNumber === -1 || !imageRef.current) return;

    const imageWidth = imageRef.current.naturalWidth;
    const imageHeight = imageRef.current.naturalHeight;
    const displayWidth = imageRef.current.clientWidth;
    const displayHeight = imageRef.current.clientHeight;

    const scaleX = imageWidth / displayWidth;
    const scaleY = imageHeight / displayHeight;

    const yoloAnnotations = boxes.map((box) => {
      const [start, end] = box.points;

      const x1 = start.x * scaleX;
      const y1 = start.y * scaleY;
      const x2 = end.x * scaleX;
      const y2 = end.y * scaleY;

      const boxWidth = Math.abs(x2 - x1);
      const boxHeight = Math.abs(y2 - y1);
      const x_center = (x1 + x2) / 2;
      const y_center = (y1 + y2) / 2;

      const norm_x = x_center / imageWidth;
      const norm_y = y_center / imageHeight;
      const norm_w = boxWidth / imageWidth;
      const norm_h = boxHeight / imageHeight;

      const labelIndex = labelOptions.indexOf(box.label);

      return `${labelIndex} ${norm_x.toFixed(6)} ${norm_y.toFixed(6)} ${norm_w.toFixed(6)} ${norm_h.toFixed(6)}`;
    });

    try {
      await axios.put(`http://localhost:8000/update_annotations/${frame_id}`, {
        annotations: yoloAnnotations,
        finished,
      });

      showNotification(
        finished ? 'Marked as finished!' : 'Saved successfully!',
        'success',
        finished ? <Check className="w-16 h-16" /> : <Save className="w-16 h-16" />
      );

      if (finished) {
        setCheckSuccess(true);
      } else {
        setCheckSuccess(false);
      }

      setHasChanges(false);

    } catch (error) {
      console.error('Error saving annotations:', error);
      showNotification(
        finished ? 'Failed to mark as finished.' : 'Failed to save.',
        'error',
        finished ? <Check className="w-16 h-16" /> : <Save className="w-16 h-16" />
      );
    }
  };

  const handleStart = async () => {
    if (!project_id) return;

    setIsLoading(true);

    try {
      const response = await axios.post(`http://localhost:8000/project/${project_id}/generate-dataset`);

      if (response.data === "Dataset labeled successfully") {
        window.location.reload();
      } else if (typeof response.data === "string" && response.data.startsWith("Not enough finished images")) {
        const match = response.data.match(/just (\d+) provided/);
        const missingImages = match ? parseInt(match[1]) : 0;

        showNotification(
          `You have to check as finished at least ${missingImages} more images.`,
          "error",
          <Trash className="w-16 h-16" />
        );
      }
    } catch (error) {
      console.error("Error generating dataset:", error);
      showNotification("An error occurred while generating the dataset.", "error", <Trash className="w-16 h-16" />);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleToolbox = () => {
    setIsToolboxExpanded((prev) => !prev);
  };

  return (
    <div className="h-screen flex flex-col bg-[#1E1E1E] text-white">
      <div className="flex items-center justify-between p-4 bg-[#1E1E1E]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/project/${project_id}`)}
          >
            <ArrowLeft className="w-6 h-6" strokeWidth={3} />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => handleSaveAnnotations(false)}
              className={!hasChanges ? 'bg-green-600 text-white' : ''}
            >
              <Save className="w-6 h-6" strokeWidth={3} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleSaveAnnotations(true)}
              className={checkSuccess ? 'bg-green-600 text-white' : ''}
            >
              <Check className="w-6 h-6" strokeWidth={3} />
            </Button>
            <Button variant="ghost">
              <Undo className="w-6 h-6" strokeWidth={3} />
            </Button>
            <Button variant="ghost">
              <Redo className="w-6 h-6" strokeWidth={3} />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 absolute left-1/2 transform -translate-x-1/2">
          <Button
            onClick={() => {
              const newFrameNumber = Math.max(1, currentFrameNumber - 1);
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/annotation/${project_id}/${newFrameNumber}`);
            }}
            className="bg-[#3C3C3C] hover:bg-white hover:text-black"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <Button
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-[#3C3C3C] hover:bg-white hover:text-black"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>
          <Button
            onClick={() => {
              const newFrameNumber = Math.min(totalImages, currentFrameNumber + 1);
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/annotation/${project_id}/${newFrameNumber}`);
            }}
            className="bg-[#3C3C3C] hover:bg-white hover:text-black"
          >
            <ArrowRight className="w-6 h-6" />
          </Button>
          <input
            type="range"
            min="1"
            max={totalImages}
            value={currentFrameNumber}
            onChange={(e) => {
              const newFrameNumber = Math.max(1, Number(e.target.value));
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/annotation/${project_id}/${newFrameNumber}`);
            }}
            className="w-32"
          />
          <input
            type="number"
            value={currentFrameNumber}
            onChange={(e) => {
              const newFrameNumber = Math.max(1, Number(e.target.value));
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/annotation/${project_id}/${newFrameNumber}`);
            }}
            className="w-16 bg-white text-black px-2 py-1 rounded"
          />
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/image-editor/${project_id}/${currentFrameNumber}`)}
          >
            <Pencil className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            className={`bg-green-600 text-white ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={handleStart}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="loader w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </div>
            ) : (
              "Start"
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        <div className="w-16 bg-[#2C2C2C] p-2 flex flex-col gap-2 relative">
          <Button variant="ghost" className="p-2" onClick={toggleToolbox}>
            <Menu className="w-6 h-6" strokeWidth={3} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentTool('box')}
            className={`p-2 ${currentTool === 'box' ? 'bg-[#404040]' : ''}`}
          >
            <SquareDashed className="w-6 h-6" strokeWidth={3} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentTool('dragBox')}
            className={`p-2 ${currentTool === 'dragBox' ? 'bg-[#404040]' : ''}`}
          >
            <MousePointer className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            onClick={handleZoomIn}
            className={`p-2 ${currentTool === 'zoomIn' ? 'bg-[#404040]' : ''}`}
          >
            <ZoomIn className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            onClick={handleZoomOut}
            className={`p-2 ${currentTool === 'zoomOut' ? 'bg-[#404040]' : ''}`}
          >
            <ZoomOut className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentTool('move')}
            className={`p-2 ${currentTool === 'move' ? 'bg-[#404040]' : ''}`}
          >
            <Move className="w-6 h-6" />
          </Button>

          {isToolboxExpanded && (
            <div
              className="absolute top-0 left-16 bg-[#2C2C2C] text-white z-50 shadow-lg"
              style={{ height: '100%', width: '120px' }}
            >
              <div className="relative h-full">
                <span className="absolute top-[58px] left-2">Bounding Box</span>
                <span className="absolute top-[101px] left-2">Edit B.Box</span>
                <span className="absolute top-[146px] left-2">Zoom In</span>
                <span className="absolute top-[190px] left-2">Reset Zoom</span>
                <span className="absolute top-[233px] left-2">Move Image</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div
            className="relative w-full h-full"
          >
            <img
              ref={imageRef}
              className="absolute inset-0 w-full object-contain"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              }}
              onLoad={() => setIsImageLoaded(true)}
            />
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              className="absolute inset-0 w-full h-full"
              style={{
                cursor: getCursorStyle(),
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              }}
            />
          </div>
        </div>

        <div className="w-80 bg-[#2C2C2C] p-4">
          <div className="flex gap-4 mb-4">
            <button className={`flex-1 p-2 ${selectedBox === null ? 'bg-gray-700' : ''}`}>
              Objects
            </button>
            <button className="flex-1 p-2">Labels</button>
            <button className="flex-1 p-2">Groups</button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="p-0 h-auto"
              onClick={toggleAllBoxesVisibility}
            >
              {allBoxesVisible ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="p-0 h-auto"
              onClick={toggleAllBoxesLock}
            >
              {allBoxesLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <LockOpen className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="p-0 h-auto hover:text-red-500"
              onClick={() => setBoxes([])}
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>

          {/* Contenedor scrolleable */}
          <div className="overflow-y-auto max-h-[50vh]">
            {boxes.map((box, index) => (
              <div
                key={box.id}
                className="mb-4 p-2 bg-[#3C3C3C] rounded"
                onMouseEnter={() => setHoveredBox(box.id)}
                onMouseLeave={() => setHoveredBox(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span>{index + 1}</span>
                  {editingName === box.id ? (
                    <input
                      type="text"
                      value={box.name}
                      onChange={(e) => handleNameChange(box.id, e.target.value)}
                      onKeyDown={(e) => handleNameKeyDown(e)}
                      autoFocus
                      className="bg-[#2C2C2C] text-white px-2 py-1 rounded"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => handleNameDoubleClick(box.id)}
                      className="cursor-pointer"
                    >
                      {box.name}
                    </span>
                  )}
                  <div className="relative dropdown-container">
                    <button
                      className="bg-white text-black px-2 py-1 rounded flex items-center justify-between min-w-[80px]"
                      onClick={() => setOpenDropdown(openDropdown === box.id ? null : box.id)}
                    >
                      <span>{box.label}</span>
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </button>
                    {openDropdown === box.id && (
                      <div className="absolute z-50 w-full mt-1 bg-white text-black rounded shadow-lg">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full px-2 py-1 border-b"
                        />
                        <div className="max-h-32 overflow-y-auto">
                          {filteredLabelOptions.map(option => (
                            <div
                              key={option}
                              className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleLabelChange(box.id, option)}
                            >
                              {option}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-0 h-auto"
                      onClick={() => toggleBoxVisibility(box.id)}
                    >
                      {box.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-0 h-auto"
                      onClick={() => toggleBoxLock(box.id)}
                    >
                      {box.locked ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <LockOpen className="w-4 h-4" />
                      )}
                    </Button>
                    <Settings className="w-4 h-4" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-0 h-auto hover:text-red-500"
                    onClick={() => handleDeleteBox(box.id)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="mb-2">Appearance</h3>
            <div className="space-y-4">
              <div>
                <p className="mb-2">Color by</p>
                <div className="flex">
                  <button className="flex-1 p-2 bg-gray-700">Label</button>
                  <button className="flex-1 p-2">Instance</button>
                  <button className="flex-1 p-2">Group</button>
                </div>
              </div>
              <div>
                <p className="mb-2">Opacity</p>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {notification && (
        <div
          className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-xl shadow-lg text-white text-center ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
        >
          <div className="flex flex-col items-center gap-2">
            {notification.icon}
            <span className="text-lg font-semibold">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};