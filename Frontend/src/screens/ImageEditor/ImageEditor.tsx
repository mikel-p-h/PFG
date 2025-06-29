import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  Menu,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  BoxSelect,
  Brush,
  Eraser,
  ZoomIn,
  ZoomOut,
  Move,
  X,
  Undo,
  Redo,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import axios from 'axios';

export const ImageEditor = () => {
  const navigate = useNavigate();
  const { project_id, id: frame_number } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [prompt, setPrompt] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pencil' | 'eraser' | 'zoomIn' | 'zoomOut' | 'move'>('pencil');
  const [brushSize, setBrushSize] = useState(5);
  const [showBrushDialog, setShowBrushDialog] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [totalImages, setTotalImages] = useState<number>(0);
  const [currentFrameNumber, setCurrentFrameNumber] = useState<number>(-1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [drawActions, setDrawActions] = useState<
    { x: number; y: number; tool: 'pencil' | 'eraser'; size: number }[]
  >([]);
  const [isToolboxExpanded, setIsToolboxExpanded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

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

  useEffect(() => {
    console.log('Popup Image:', popupImage);
    console.log('Show Popup:', showPopup);
  }, [popupImage, showPopup]);

  useEffect(() => {
    const updateCanvasSize = () => {
      if (!imageRef.current || !canvasRef.current) return;

      const img = imageRef.current;
      const canvas = canvasRef.current;

      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    };

    updateCanvasSize();

    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [imageSrc, zoom]);

  useEffect(() => {
    const fetchImageCount = async () => {
      if (!project_id) return;

      try {
        const response = await axios.get<{ total_images: number }>(`http://localhost:8000/project/${project_id}/image_count`);
        setTotalImages(response.data.total_images);
      } catch (error) {
        console.error('Error fetching image count:', error);
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
    if (currentFrameNumber !== -1) {
      fetchImage(currentFrameNumber);
    }
  }, [currentFrameNumber]);

  useEffect(() => {
    const redrawCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawActions.forEach(({ x, y, tool, size }) => {
        if (tool === 'eraser') {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (tool === 'pencil') {
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      });
    };

    redrawCanvas();
  }, [drawActions, zoom]);

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'pencil' && currentTool !== 'eraser') return;
  
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) return;
  
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
  
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    if (lastPos.current) {
      const { x: lastX, y: lastY } = lastPos.current;
  
      const distance = Math.hypot(x - lastX, y - lastY);
      const steps = Math.ceil(distance / (brushSize / 2));
  
      for (let i = 0; i <= steps; i++) {
        const interpolatedX = lastX + (x - lastX) * (i / steps);
        const interpolatedY = lastY + (y - lastY) * (i / steps);
  
        setDrawActions((prev) => [
          ...prev,
          { x: interpolatedX, y: interpolatedY, tool: currentTool, size: brushSize },
        ]);
  
        if (currentTool === 'eraser') {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(interpolatedX, interpolatedY, brushSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (currentTool === 'pencil') {
          ctx.beginPath();
          ctx.arc(interpolatedX, interpolatedY, brushSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }
    }
  
    lastPos.current = { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'move') {
      setIsDrawing(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      setIsDrawing(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      lastPos.current = {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
      };
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      const newZoom = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.min(Math.max(newZoom, 0.5), 3);
    });
  };

  const getCursorStyle = () => {
    switch (currentTool) {
      case 'pencil':
      case 'eraser':
        return 'none';
      case 'zoomIn':
        return 'zoom-in';
      case 'zoomOut':
        return 'zoom-out';
      case 'move':
        return 'grab';
      default:
        return 'default';
    }
  };

  const fetchImage = async (frameNumber: number) => {
    if (!project_id) return;

    try {
      const response = await axios.get(`http://localhost:8000/project/${project_id}/image/${frameNumber}`);
      const data = response.data as ImageDataResponse;

      const imageFormat = data.format || 'jpeg';
      const imageBase64 = data.image;

      setImageSrc(`data:image/${imageFormat};base64,${imageBase64}`);
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCursorPos({ x, y });

    if (isDrawing && currentTool === 'move' && lastPos.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;

      setPan((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));

      lastPos.current = { x: e.clientX, y: e.clientY };
    }

    if (isDrawing && currentTool !== 'move') {
      draw(e);
    }
  };

  const toggleToolbox = () => {
    setIsToolboxExpanded((prev) => !prev);
  };

  const handleStart = async () => {
    if (!imageRef.current || !canvasRef.current) return;

    setIsStarting(true);

    try {
      const maskCanvas = generateMask();
      if (!maskCanvas) throw new Error('Failed to generate mask');

      const originalWidth = imageRef.current.naturalWidth;
      const originalHeight = imageRef.current.naturalHeight;
      const resizedMaskCanvas = resizeCanvas(maskCanvas, originalWidth, originalHeight);
      if (!resizedMaskCanvas) throw new Error('Failed to resize mask');

      const maskBlob = await new Promise<Blob | null>((resolve) =>
        resizedMaskCanvas.toBlob((blob) => resolve(blob), 'image/png')
      );
      if (!maskBlob) throw new Error('Failed to create mask blob');

      const imageBlob = await fetch(imageRef.current.src).then((res) => res.blob());
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('image', imageBlob, 'image.png');
      formData.append('mask', maskBlob, 'mask.png');

      const response = await axios.post('http://localhost:5002/inpainting', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      });

      setShowPopup(true);

      const generatedImage = URL.createObjectURL(response.data as Blob);
      console.log('Generated Image URL:', generatedImage);
      setPopupImage(generatedImage);
    } catch (error) {
      console.error('Error during inpainting:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const generateMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;

    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;

    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.drawImage(canvas, 0, 0);

    return maskCanvas;
  };

  const resizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;

    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(canvas, 0, 0, width, height);
    return resizedCanvas;
  };

  const handleSave = async () => {
    if (!popupImage || !project_id) return;

    setIsSaving(true);

    try {
      const response = await fetch(popupImage);
      const imageBlob = await response.blob();

      const formData = new FormData();
      formData.append('file', imageBlob, 'synthetic_image.png');

      await axios.post(`http://localhost:8000/synthetic?project_id=${project_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowPopup(false);
    } catch (error) {
      console.error('Error saving synthetic image:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const transformStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'top left',
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
          <Button variant="ghost">
            <Undo className="w-6 h-6" strokeWidth={3} />
          </Button>
          <Button variant="ghost">
            <Redo className="w-6 h-6" strokeWidth={3} />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 absolute left-1/2 transform -translate-x-1/2">
          <Button
            onClick={() => {
              const newFrameNumber = Math.max(1, currentFrameNumber - 1);
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/image-editor/${project_id}/${newFrameNumber}`);
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
              navigate(`/image-editor/${project_id}/${newFrameNumber}`);
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
              const newFrameNumber = Number(e.target.value);
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/image-editor/${project_id}/${newFrameNumber}`);
            }}
            className="w-32"
          />
          <input
            type="number"
            value={currentFrameNumber}
            onChange={(e) => {
              const newFrameNumber = Math.max(0, Number(e.target.value) - 1);
              setCurrentFrameNumber(newFrameNumber);
              navigate(`/image-editor/${project_id}/${newFrameNumber}`);
            }}
            className="w-16 bg-white text-black px-2 py-1 rounded"
          />
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/annotation/${project_id}/${currentFrameNumber}`)}
          >
            <BoxSelect className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            className="bg-green-600 text-white"
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start'}
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
            onClick={() => {
              setCurrentTool('pencil');
              setShowBrushDialog(true);
            }}
            className={`p-2 ${currentTool === 'pencil' ? 'bg-[#404040]' : ''}`}
          >
            <Brush className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentTool('eraser');
              setShowBrushDialog(true);
            }}
            className={`p-2 ${currentTool === 'eraser' ? 'bg-[#404040]' : ''}`}
          >
            <Eraser className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentTool('zoomIn');
              handleZoom('in');
            }}
            className={`p-2 ${currentTool === 'zoomIn' ? 'bg-[#404040]' : ''}`}
          >
            <ZoomIn className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentTool('zoomOut');
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
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
                <span className="absolute top-[58px] left-2">Brush</span>
                <span className="absolute top-[101px] left-2">Eraser</span>
                <span className="absolute top-[146px] left-2">Zoom In</span>
                <span className="absolute top-[190px] left-2">Reset Zoom</span>
                <span className="absolute top-[233px] left-2">Move Image</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            {imageSrc ? (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Current"
                className="absolute inset-0 object-contain"
                style={transformStyle}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                Loading image...
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{
                ...transformStyle,
                cursor: getCursorStyle(),
              }}
              onMouseDown={startDrawing}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={() => setCursorPos(null)}
            />
            {cursorPos && (currentTool === 'pencil' || currentTool === 'eraser') && (
              <div
                className="absolute pointer-events-none rounded-full border border-white"
                style={{
                  width: brushSize * zoom,
                  height: brushSize * zoom,
                  left: cursorPos.x - (brushSize * zoom) / 2 + pan.x,
                  top: cursorPos.y - (brushSize * zoom) / 2 + pan.y,
                  boxShadow: '0 0 0 2px black',
                }}
              />
            )}
          </div>

          <div className="p-4 bg-[#2C2C2C]">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              className="w-full h-24 p-2 bg-[#1E1E1E] text-white rounded border border-gray-600 resize-none"
            />
          </div>
        </div>
      </div>

      <Dialog open={showBrushDialog} onOpenChange={setShowBrushDialog}>
        <DialogContent className="bg-[#2C2C2C] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Brush And Eraser Size</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBrushDialog(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <input
              type="range"
              min="1"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full"
            />
            <input
              type="number"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full border border-gray-600 rounded"
            />
          </div>
        </DialogContent>
      </Dialog>

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex z-50 items-center justify-center">
          <div
            className="bg-[#2C2C2C] text-white pt-3 pl-3 pr-3 rounded-lg shadow-lg flex flex-col"
            style={{
              width: '80%',
              height: '80%',
            }}
          >
            <div className="h-[75%] flex-1 flex items-center justify-center">
              {popupImage ? (
                <img
                  src={popupImage}
                  alt="Generated"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-gray-400">Loading image...</div>
              )}
            </div>
            <div className="flex items-center justify-center gap-10 p-3">
              <Button
                variant="outline"
                className="bg-red-600 text-white"
                onClick={() => setShowPopup(false)}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                className="bg-green-600 text-white"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};