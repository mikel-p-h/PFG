import React from "react";
import { FigmaIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "./avatar";

interface HeaderProps {
  userName: string;
  userEmail: string;
  extraContent?: React.ReactNode; // Prop opcional para contenido adicional
  isProjectsUnderlined?: boolean; // Prop opcional para controlar el subrayado
  showProjects?: boolean; // Prop opcional para mostrar/ocultar "Projects"
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  userEmail,
  extraContent,
  isProjectsUnderlined = false, // Valor por defecto: no subrayado
  showProjects = true, // Valor por defecto: mostrar "Projects"
}) => {
  return (
    <header className="flex items-center justify-between p-8 bg-[#9c8282] border-b border-[#d9d9d9]">
      {/* Ícono de Figma */}
      <div className="flex items-center gap-6">
        <FigmaIcon className="w-10 h-10" />
      </div>

      {/* Contenido adicional (si se proporciona) */}
      {extraContent && <div className="ml-auto">{extraContent}</div>}

      {/* Texto "Projects" e información del usuario alineados a la derecha */}
      <div className="flex items-center gap-6">
        {showProjects && (
          <span
            className={`text-base font-normal text-[#1e1e1e] ${
              isProjectsUnderlined ? "underline" : ""
            }`}
          >
            Projects
          </span>
        )}
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-[url(/shape.png)] bg-cover bg-[50%_50%]" />
          </Avatar>
          <div>
            <div className="font-semibold">{userName}</div>
            <div className="opacity-90">{userEmail}</div>
          </div>
        </div>
      </div>
    </header>
  );
};