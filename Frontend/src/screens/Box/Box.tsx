import {
  CheckIcon,
  TrashIcon,
  UserIcon,
  MoreHorizontal,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import apiClient from "../../apiClient";
import { FrownIcon } from "lucide-react";
import { Header } from "../../components/ui/Header";

export const Box = (): JSX.Element => {
  const navigate = useNavigate();
  const userEmail = "testuser@example.com";
  const userName = "Test User";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [filters, setFilters] = useState([
    { id: "finished", label: "Finished", active: false },
    { id: "inProgress", label: "In Progress", active: false },
    { id: "notStarted", label: "Not Started", active: false },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[] | null>(null);
  const [openLabelDropdown, setOpenLabelDropdown] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  interface Tag {
    text: string;
    color: string;
    state: string;
  }

  interface Project {
    project_id: string;
    name: string;
    tags: Tag[];
    owner: string;
    state: string;
  }

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get<{ projects: any[] }>("/projects", {
        params: {
          email: userEmail, 
          states: filters.filter((filter) => filter.active).map((filter) => filter.label),
        },
      });

      const transformedProjects = response.data.projects.map((project) => {
        const labels = JSON.parse(project.labels[0]); 
        const colors = JSON.parse(project.colors[0]); 

        const combinedTags = labels.map((label: string, index: number) => ({
          text: label,
          color: colors[index],
        }));

        return {
          ...project,
          tags: combinedTags,
          state: project.status || "Not Started", 
        };
      });

      setProjects(transformedProjects);
      setFilteredProjects(transformedProjects); 
    } catch (error: any) {
      if (error.response?.status === 404) {
        setFilteredProjects([]); 
      } else {
        console.error("Error fetching projects:", error);
      }
    }
  };

  useEffect(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const activeStates = filters.filter((f) => f.active).map((f) => f.label);

    const filtered = projects.filter((project) => {
      const matchesState =
        activeStates.length === 0 || activeStates.includes(project.state); 
      const matchesSearch = project.name.toLowerCase().includes(lowerSearch);
      return matchesState && matchesSearch;
    });

    setFilteredProjects(filtered);
  }, [searchTerm, projects, filters]);

  useEffect(() => {
    fetchProjects();
  }, [filters]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deleteDialogOpen && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      clearInterval(timer);
      setCountdown(5);
    };
  }, [deleteDialogOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openLabelDropdown !== null && !(event.target as HTMLElement).closest(".label-dropdown")) {
        setOpenLabelDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openLabelDropdown]);

  const handleDeleteClick = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      setIsDeleting(true); 
      try {
        const response = await apiClient.delete<{ message: string }>(`/project/${projectToDelete}`);
        console.log(response.data.message);

        setProjects(projects.filter((project) => project.project_id !== projectToDelete));
        setFilteredProjects(
          filteredProjects?.filter((project) => project.project_id !== projectToDelete) || null
        );

        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      } catch (error: any) {
        console.error('Error deleting project:', error.response?.data?.detail || error.message);
      } finally {
        setIsDeleting(false);
      }
    }
  };


  const toggleFilter = (filterId: string) => {
    setFilters(
      filters.map((filter) => ({
        ...filter,
        active: filter.id === filterId ? !filter.active : filter.active,
      }))
    );
  };

  const toggleLabelDropdown = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenLabelDropdown(openLabelDropdown === projectId ? null : projectId);
  };

  return (
    <div className="w-full h-screen">
      <Header
        userName={userName}
        userEmail={userEmail}
        isProjectsUnderlined={true} 
      />
      <div className="w-full h-full">
        <div className="relative w-full h-full">


          <div className="w-full bg-white p-8">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-[#2c2c2c]"
                />
                <Button
                  className="bg-[#2c2c2c] text-neutral-100 rounded-lg"
                  onClick={() => navigate("/new-project")}
                >
                  New Project
                </Button>
              </div>

              <div className="flex gap-2">
                {filters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant={filter.active ? "default" : "outline"}
                    className={`rounded-lg ${filter.active ? "bg-[#2c2c2c] text-neutral-100" : "bg-neutral-100 text-[#757575]"
                      }`}
                    onClick={() => toggleFilter(filter.id)}
                  >
                    {filter.active && <CheckIcon className="w-4 h-4 mr-2" />}
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            {filteredProjects === null ? (
              <div className="text-center py-16 text-gray-500">Loading projects...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full py-16 text-center text-gray-500">
                <FrownIcon className="w-10 h-10 mb-4 text-gray-400" />
                <p className="text-lg font-medium">No projects found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {filteredProjects.map((project) => (
                  <Card
                    key={project.project_id}
                    className="bg-[#d9d9d9] relative h-[115px] cursor-pointer hover:bg-[#d0d0d0] transition-colors"
                    onClick={() => navigate(`/project/${project.project_id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between">
                        <div className="font-normal text-black text-base">{project.name}</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-auto p-0 group"
                          onClick={(e) => handleDeleteClick(project.project_id, e)}
                        >
                          <TrashIcon className="w-[18px] h-[17px] group-hover:text-red-500 transition-colors" />
                        </Button>
                      </div>

                      <div className="flex items-center mt-6 justify-between">
                        <div className="flex items-center gap-2">
                          {project.tags.slice(0, 2).map((tag, index) => (
                            <Badge
                              key={index}
                              className="text-black font-extralight h-8 px-2"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.text}
                            </Badge>
                          ))}
                          {project.tags.length > 2 && (
                            <div className="relative label-dropdown">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={(e) => toggleLabelDropdown(project.project_id, e)}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                              {openLabelDropdown === project.project_id && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg z-10 min-w-[150px]">
                                  {project.tags.slice(2).map((tag, index) => (
                                    <div
                                      key={index}
                                      className="p-2 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      <span className="text-sm text-gray-700">{tag.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-7 h-[29px] flex items-center justify-center bg-[#d9d9d9] rounded-[32px] border border-solid border-[#b3b3b3]">
                            <UserIcon className="w-5 h-5" />
                          </div>
                          <span className="font-extralight text-black text-base">
                            Owner: {project.owner === userEmail ? "Me" : project.owner}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              variant="destructive"
              disabled={countdown > 0 || isDeleting} 
              onClick={handleConfirmDelete}
              className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Deleting" : countdown > 0 ? `Confirm (${countdown}s)` : "Confirm"}
            </Button>
            <Button
              variant="outline"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};