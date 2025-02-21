import React from "react";

export default function ProjectCard({ project, isSelected, onSelect }) {
    // Date formatting utility
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    return (
        <div
            className={`flex flex-col rounded-xl shadow-xl overflow-hidden w-72 h-52 transform transition-all duration-300 
                hover:scale-105 cursor-pointer border-2 ${isSelected ? "border-blue-400" : "border-transparent"}
                hover:shadow-2xl`}
            style={{
                backgroundColor: isSelected ? "#0068F7" : "#121222",
            }}
            onClick={onSelect}
        >
            {/* Hidden Radio Button */}
            <input
                type="radio"
                checked={isSelected}
                onChange={onSelect}
                className="hidden"
            />

            <div className="p-4 flex-1 flex flex-col gap-2">
                {/* Title Section */}
                <div className="flex items-center justify-between">
                    <h1
                        className="text-xl font-extrabold tracking-tight line-clamp-1"
                        style={{
                            color: isSelected ? "#FFFFFF" : "#F3F4F6",
                        }}
                    >
                        {project.name}
                    </h1>
                    <span className="text-xs font-medium px-2 py-1 rounded-full"
                        style={{
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
                            color: isSelected ? "#FFFFFF" : "#9CA3AF",
                        }}
                    >
                        {formatDate(project.endDate)}
                    </span>
                </div>

                {/* Description */}
                <p
                    className="text-sm font-medium line-clamp-2 mb-2"
                    style={{
                        color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(156,163,175,0.9)",
                    }}
                >
                    {project.description}
                </p>

                {/* Metadata Section */}
                <div className="mt-auto space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M1 4c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4zm2 2v12h14V6H3zm2-6h2v2H5V0zm8 0h2v2h-2V0zM5 9h2v2H5V9zm0 4h2v2H5v-2zm4-4h2v2H9V9zm0 4h2v2H9v-2zm4-4h2v2h-2V9zm0 4h2v2h-2v-2z"/>
                        </svg>
                        <span style={{ color: isSelected ? "#E5E7EB" : "#9CA3AF" }}>
                            Created: {formatDate(project.createdAt)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Status Section */}
            <div className="px-4 py-3 flex items-center justify-between"
                style={{
                    backgroundColor: isSelected ? "rgba(0,104,247,0.15)" : "rgba(255,255,255,0.05)",
                }}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                        project.status === 'Active' ? 'bg-green-400' : 
                        project.status === 'Completed' ? 'bg-blue-400' : 'bg-yellow-400'
                    }`} />
                    <span className="text-sm font-semibold capitalize"
                        style={{
                            color: isSelected ? "#FFFFFF" : "#9CA3AF",
                        }}
                    >
                        {project.status.toLowerCase()}
                    </span>
                </div>
            </div>
        </div>
    );
}