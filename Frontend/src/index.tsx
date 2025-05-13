import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box } from "./screens/Box";
import { NewProject } from "./screens/NewProject";
import { ProjectDetails } from "./screens/ProjectDetails";
import { Annotation } from "./screens/Annotation";
import { ImageEditor } from "./screens/ImageEditor";

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Box />} />
        <Route path="/new-project" element={<NewProject />} />
        <Route path="/project/:projectId" element={<ProjectDetails />} />
        <Route path="/annotation/:project_id/:id" element={<Annotation />} />
        <Route path="/image-editor/:project_id/:id" element={<ImageEditor />} />
      </Routes>
    </Router>
  </StrictMode>
);