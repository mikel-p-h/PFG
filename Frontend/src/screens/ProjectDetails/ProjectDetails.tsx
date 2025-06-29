import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { HexColorPicker } from 'react-colorful';
import { Header } from '../../components/ui/Header';
import { SearchIcon, PlusIcon, Pencil, Check, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';

export const ProjectDetails = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIndex, setSelectedTagIndex] = useState<number | null>(null);
  const [showNewLabelDialog, setShowNewLabelDialog] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#ff0000');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [projectName, setProjectName] = useState('Project Name');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState('');
  const [tags, setTags] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 6;
  const [showSharePopup, setShowSharePopup] = useState(false);
  const userEmail = "testuser@example.com";
  const [emailToShare, setEmailToShare] = useState('');
  const sharePopupRef = useRef<HTMLDivElement>(null);
  const [isModified, setIsModified] = useState(false);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
        setSelectedTagIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sharePopupRef.current && !sharePopupRef.current.contains(event.target as Node)) {
        setShowSharePopup(false);
      }
    };

    if (showSharePopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSharePopup]);

  useEffect(() => {
    loadMoreImages();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const fetchLabels = async () => {
      try {
        const response = await axios.get<{ name: string; color: string }[]>(
          `http://localhost:8000/project/${projectId}/labels`
        );

        const { name, color } = response.data[0];
        const parsedNames = JSON.parse(name);
        const parsedColors = JSON.parse(color);
        const formattedTags = parsedNames.map((label: string, index: number) => ({
          name: label,
          color: parsedColors[index],
          active: false,
        }));

        setTags(formattedTags);
      } catch (error) {
        console.error("Error fetching project labels:", error);
      }
    };

    fetchLabels();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const fetchProjectName = async () => {
      try {
        const response = await axios.get<{ name: string }>(
          `http://localhost:8000/project/${projectId}`
        );
        setProjectName(response.data.name);
      } catch (error) {
        console.error('Error fetching project name:', error);
      }
    };

    fetchProjectName();
  }, [projectId]);

  const loadMoreImages = async () => {
    if (!projectId || !hasMore) return;

    setLoading(true);

    let localSkip = skip;

    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.get<{ images: any[] }>(
          `http://localhost:8000/project/${projectId}/images`,
          {
            params: {
              skip: localSkip,
              limit,
            },
          }
        );

        const newImages = response.data.images ?? [];
        setImages((prev) => [...prev, ...newImages]);
        localSkip += limit;

        if (newImages.length < limit) {
          setHasMore(false);
          break;
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          setHasMore(false);
          break;
        } else {
          console.error('Error loading images:', error);
        }
      }
    }

    setSkip(localSkip);
    setLoading(false);
  };

  const handleStartEditing = () => {
    setTempProjectName(projectName);
    setIsEditingName(true);
  };

  const handleConfirmEdit = async () => {
    if (tempProjectName.trim() && tempProjectName !== projectName) {
      setProjectName(tempProjectName);
      setIsEditingName(false);

      try {
        await axios.put(`http://localhost:8000/project/${projectId}/rename`, {
          name: tempProjectName,
        });
      } catch (error) {
        console.error('Error updating project name:', error);
      }
    } else {
      setIsEditingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  const handleColorChange = (color: string) => {
    if (selectedTagIndex !== null) {
      const newTags = [...tags];
      newTags[selectedTagIndex] = { ...newTags[selectedTagIndex], color };
      setTags(newTags);
      setIsModified(true);
    }
  };

  const handleAddNewLabel = () => {
    if (newLabelName.trim()) {
      setTags([...tags, { name: newLabelName, color: newLabelColor, active: false }]);
      setNewLabelName('');
      setNewLabelColor('#ff0000');
      setShowNewLabelDialog(false);
      setIsModified(true);
    }
  };

  const handleSaveLabels = async () => {
    if (!projectId) {
      console.error('Project ID is missing');
      return;
    }

    try {
      const formData = new FormData();
      const labelNames = tags.map((tag) => tag.name);
      const labelColors = tags.map((tag) => tag.color);

      formData.append('labels', JSON.stringify(labelNames));
      formData.append('colors', JSON.stringify(labelColors));

      const response = await axios.put<{ message: string }>(
        `http://localhost:8000/project/${projectId}/labels`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log(response.data.message);
      setIsModified(false);
    } catch (error: any) {
      console.error('Error updating labels:', error.response?.data?.detail || error.message);
    }
  };

  const handleDownload = async (includeImages: boolean) => {
    if (!projectId) return;
  
    try {
      const response = await axios.get(
        `http://localhost:8000/download/${projectId}`,
        {
          params: { include_images: includeImages },
          responseType: 'blob',
        }
      );
  
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project_${projectId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading project data:', error);
    } finally {
      setShowDownloadPopup(false);
    }
  };

  const filteredImages = images.filter((img) =>
    img.image_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <Header
        userName="Test User"
        userEmail={userEmail}
        isProjectsUnderlined={true}
        showProjects={false}
        extraContent={
          <div className="flex items-center gap-4 relative">
            <span
              className="cursor-pointer hover:text-gray-700"
              onClick={() => navigate('/')}
            >
              Projects
            </span>
            <Button
              variant="secondary"
              className="bg-[#E8DEF8] text-[#6750A4] mr-4"
              onClick={() => setShowSharePopup(!showSharePopup)}
            >
              Share
            </Button>

            {showSharePopup && (
              <div
                ref={sharePopupRef}
                className="absolute top-12 right-0 bg-white shadow-lg border border-gray-300 rounded-lg p-1 w-72 z-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 ml-2">Share With:</span>
                  <button
                    className="w-6 h-6 flex items-center justify-center bg-red-500 text-white hover:bg-red-700"
                    onClick={() => setShowSharePopup(false)}
                  >
                    <span className="text-sm font-bold">X</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={emailToShare}
                    onChange={(e) => setEmailToShare(e.target.value)}
                    placeholder="Enter email"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    className="bg-[#2C2C2C] text-white hover:bg-[#404040]"
                    onClick={async () => {
                      if (!projectId || !userEmail || !emailToShare) {
                        console.error('Missing data for sharing project');
                        return;
                      }

                      try {
                        const formData = new FormData();
                        formData.append('project_id', projectId);
                        formData.append('owner_email', userEmail);
                        formData.append('recipient_email', emailToShare);

                        await axios.post('http://localhost:8000/share_project', formData, {
                          headers: {
                            'Content-Type': 'multipart/form-data',
                          },
                        });

                        setEmailToShare('');
                        setShowSharePopup(false);
                      } catch (error: any) {
                        console.error('Error sharing project:', error.response?.data?.detail || error.message);
                      }
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="bg-[#FEF7F7] py-4 px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={tempProjectName}
                onChange={(e) => setTempProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-xl font-semibold bg-white"
                autoFocus
              />
              <Button size="sm" onClick={handleConfirmEdit} className="bg-[#2C2C2C] text-white hover:bg-[#404040]">
                <Check className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">{projectName}</span>
              <Button variant="ghost" size="sm" onClick={handleStartEditing} className="p-1 hover:bg-black/10 rounded-full">
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="bg-[#2C2C2C] text-white hover:bg-[#404040] flex items-center gap-2"
          onClick={() => setShowDownloadPopup(true)}
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
      </div>

      <div className="flex h-[calc(100vh-180px)]">
        <div className="w-64 p-4 border-r">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tags</h2>
            <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => setShowNewLabelDialog(true)}>
              <PlusIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-4">
            {tags.map((tag, index) => (
              <div key={index} className="flex items-center gap-2 mb-2 relative">
                <div
                  className="w-4 h-4 rounded-full cursor-pointer"
                  style={{ backgroundColor: tag.color }}
                  onClick={() => setSelectedTagIndex(selectedTagIndex === index ? null : index)}
                />
                {tag.isEditing ? (
                  <Input
                    value={tag.name}
                    onChange={(e) => {
                      const newTags = [...tags];
                      newTags[index].name = e.target.value;
                      setTags(newTags);
                    }}
                    onBlur={() => {
                      const newTags = [...tags];
                      newTags[index].isEditing = false;
                      setTags(newTags);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newTags = [...tags];
                        newTags[index].isEditing = false;
                        setTags(newTags);
                      }
                    }}
                    autoFocus
                    className="flex-1"
                  />
                ) : (
                  <span className="flex-1 truncate">{tag.name}</span>
                )}
                <button
                  className={`p-1 rounded-full ml-auto ${tag.isEditing
                      ? 'bg-[#2C2C2C] text-white hover:bg-[#404040]'
                      : 'hover:bg-gray-200'
                    }`}
                  onClick={() => {
                    const newTags = [...tags];
                    if (tag.isEditing) {
                      newTags[index].isEditing = false;
                    } else {
                      newTags[index].isEditing = true;
                    }
                    setTags(newTags);
                    setIsModified(true);
                  }}
                >
                  {tag.isEditing ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Pencil className="w-4 h-4" />
                  )}
                </button>
                {selectedTagIndex === index && (
                  <div className="absolute left-0 top-6 z-10" ref={colorPickerRef}>
                    <HexColorPicker color={tag.color} onChange={handleColorChange} />
                  </div>
                )}
              </div>
            ))}

            <div className="mt-4 flex justify-center">
              <Button
                className={`${isModified ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500'
                  } text-white`}
                onClick={handleSaveLabels}
                disabled={!isModified}
              >
                Save
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="relative w-[400px]">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="pl-10 pr-4 py-2 rounded-full border border-gray-300"
              />
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                className="bg-gray-100 rounded-lg p-4 cursor-pointer"
                onDoubleClick={() => navigate(`/annotation/${projectId}/${img.frame_number}`)}
              >
                <img
                  src={`data:image/jpeg;base64,${img.image}`}
                  alt={img.image_name}
                  className="aspect-square object-cover rounded-lg mb-2 w-full"
                />
                <div className="text-center text-sm font-medium text-gray-700">
                  {img.image_name}
                </div>
              </div>
            ))}
          </div>


          {loading && <div className="text-center text-gray-500">Loading images...</div>}

          {!hasMore && !loading && (
            <div className="text-center text-gray-500 mt-4">
              There are no more images to load.
            </div>
          )}

          {hasMore && !loading && (
            <div className="flex justify-center mt-8">
              <Button onClick={loadMoreImages}>Load More</Button>
            </div>
          )}
        </div>
      </div>

      {showDownloadPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Do you want to download annotations and images?
            </h2>
            <div className="flex justify-between">
              <Button
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => handleDownload(true)}
              >
                Both
              </Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => handleDownload(false)}
              >
                Annotations
              </Button>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => setShowDownloadPopup(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showNewLabelDialog} onOpenChange={setShowNewLabelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Label</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Label name"
              className="mb-4"
            />
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full cursor-pointer"
                style={{ backgroundColor: newLabelColor }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              />
              <span>Select color</span>
            </div>
            {showColorPicker && (
              <div className="mt-2" ref={colorPickerRef}>
                <HexColorPicker color={newLabelColor} onChange={setNewLabelColor} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLabelDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewLabel}>Add Label</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};