import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { CameraIcon, UploadIcon, XIcon, PlusIcon } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { Header } from '../../components/ui/Header';
import JSZip from 'jszip';
import axios from 'axios';

export const NewProject = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [labels, setLabels] = useState<Array<{ text: string; color: string }>>([]);
  const [newLabel, setNewLabel] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#aafd95');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const annotationsInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedAnnotations, setUploadedAnnotations] = useState<File[]>([]);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [annotationSearchTerm, setAnnotationSearchTerm] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddLabel = () => {
    if (newLabel.trim()) {
      setLabels([...labels, { text: newLabel.trim(), color: selectedColor }]);
      setNewLabel('');
      setShowColorPicker(false);
    }
  };

  const handleRemoveLabel = (index: number) => {
    setLabels(labels.filter((_, i) => i !== index));
  };

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleAnnotationsClick = () => {
    annotationsInputRef.current?.click();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setShowCamera(false);
    }
  };

  const handleRemoveFile = (index: number, type: 'files' | 'annotations') => {
    if (type === 'files') {
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setUploadedAnnotations((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleDropFiles = (event: React.DragEvent<HTMLDivElement>, type: 'files' | 'annotations') => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);

    if (type === 'files') {
      const validFiles = files.filter(
        (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
      );
      setUploadedFiles((prev) => [...prev, ...validFiles]);
    } else if (type === 'annotations') {
      const validAnnotations = files.filter((file) => file.name.endsWith('.txt'));
      setUploadedAnnotations((prev) => [...prev, ...validAnnotations]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleConfirm = async () => {
    if (!projectName || labels.length === 0 || uploadedFiles.length === 0) return;

    try {
      const zip = new JSZip();

      uploadedFiles.forEach((file) => {
        zip.file(file.name, file);
      });

      uploadedAnnotations.forEach((file) => {
        zip.file(file.name, file);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const formData = new FormData();
      formData.append('project_name', projectName);
      formData.append('project_owner', 'testuser@example.com');
      formData.append('labels', JSON.stringify(labels.map((label) => label.text)));
      formData.append('colors', JSON.stringify(labels.map((label) => label.color)));
      formData.append('folder', new File([zipBlob], `${projectName}.zip`));

      await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      navigate('/');
    } catch (error) {
      console.error('Error al subir el proyecto:', error);
    }
  };

  const isConfirmDisabled = !projectName || labels.length === 0 || uploadedFiles.length === 0;

  return (
    <div className="min-h-screen bg-white">
      <Header
        userName="Test User"
        userEmail="testuser@example.com"
        showProjects={false}
        extraContent={
          <div className="flex items-center gap-4">
            <span
              className="cursor-pointer hover:text- gmrra-y4-700 mr-4"
              onClick={() => navigate('/')}
            >
              Projects
            </span>
          </div>
        }
      />

      <div className="p-6">
        <div className="flex items-center mb-8">
          <Button
            onClick={() => navigate('/')}
            className="bg-[#2C2C2C] text-white hover:bg-[#404040]"
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            className="bg-[#6750A4] text-white hover:bg-[#6750A4]/90"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            Confirm
          </Button>
        </div>

        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Project Name*"
          className="mb-8 border-0 border-b border-gray-300 rounded-none px-0 h-12 text-lg focus-visible:ring-0 focus-visible:border-[#6750A4]"
        />

        <div className="mb-8">
          <p className="text-sm text-gray-600 mb-2">Labels*:</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {labels.map((label, index) => (
              <div key={index} className="relative group">
                <Badge
                  className="relative"
                  style={{ backgroundColor: label.color }}
                >
                  {label.text}
                  <button
                    onClick={() => handleRemoveLabel(index)}
                    className="absolute -right-1 -top-1 bg-red-500 text-white rounded-full p-0.5 hidden group-hover:block"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Add label"
              className="w-24 h-8 px-2 text-sm border border-gray-300"
              onFocus={() => setShowColorPicker(true)}
            />
            {showColorPicker && (
              <div className="relative" ref={colorPickerRef}>
                <div className="absolute z-10">
                  <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
                </div>
              </div>
            )}
            <div
              className="w-6 h-6 rounded-full cursor-pointer"
              style={{ backgroundColor: selectedColor }}
              onClick={() => setShowColorPicker(true)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddLabel}
              className="p-1"
            >
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col">
            <p className="text-sm text-gray-600 mb-2">Select Files (Images/Videos)*:</p>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropFiles(e, 'files')}
              onClick={handleImageClick}
            >
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                multiple
                accept="image/*,video/*"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const validFiles = Array.from(files).filter(
                      (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
                    );
                    setUploadedFiles((prev) => [...prev, ...validFiles]);
                  }
                }}
              />
              <UploadIcon className="w-8 h-8 mb-4 text-gray-400" />
              <p className="text-sm text-center text-gray-600 mb-2">
                Click or drag files to this area
              </p>
              <p className="text-xs text-center text-gray-400 mb-4">
                You can upload images or videos
              </p>
              <p className="text-sm text-center text-gray-600 mb-4">OR</p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
              >
                <CameraIcon className="w-4 h-4" />
                Open Camera
              </Button>
            </div>
            {/* Buscador y lista de archivos */}
            <div className="mt-4">
              <input
                type="text"
                placeholder="Search files..."
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
                className="w-full p-2 mb-2 border border-gray-300 rounded"
              />
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded p-2">
                {uploadedFiles
                  .filter((file) =>
                    file.name.toLowerCase().includes(fileSearchTerm.toLowerCase())
                  )
                  .map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-100 p-2 rounded mb-2"
                    >
                      <span className="text-sm text-gray-800 truncate">{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(index, 'files')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <p className="text-sm text-gray-600 mb-2">Select Annotations:</p>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropFiles(e, 'annotations')}
              onClick={handleAnnotationsClick}
            >
              <input
                type="file"
                ref={annotationsInputRef}
                className="hidden"
                multiple
                accept=".txt"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const validAnnotations = Array.from(files).filter((file) => file.name.endsWith('.txt'));
                    setUploadedAnnotations((prev) => [...prev, ...validAnnotations]);
                  }
                }}
              />
              <UploadIcon className="w-8 h-8 mb-4 text-gray-400" />
              <p className="text-sm text-center text-gray-600">
                Click or drag files to this area
              </p>
            </div>
            {/* Buscador y lista de anotaciones */}
            <div className="mt-4">
              <input
                type="text"
                placeholder="Search annotations..."
                value={annotationSearchTerm}
                onChange={(e) => setAnnotationSearchTerm(e.target.value)}
                className="w-full p-2 mb-2 border border-gray-300 rounded"
              />
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded p-2">
                {uploadedAnnotations
                  .filter((file) =>
                    file.name.toLowerCase().includes(annotationSearchTerm.toLowerCase())
                  )
                  .map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-100 p-2 rounded mb-2"
                    >
                      <span className="text-sm text-gray-800 truncate">{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(index, 'annotations')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg">
              <video ref={videoRef} autoPlay className="mb-4" />
              <Button onClick={stopCamera} variant="destructive">
                Close Camera
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};