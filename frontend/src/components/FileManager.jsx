import React, { useState, useEffect } from 'react';
import { FiMenu } from 'react-icons/fi';
import { useSshSession } from '../hooks/useSshSession';

export default function FileManager({ toggleSidebar }) {
  const { sessionReady, executeCommand } = useSshSession();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionReady) {
      loadDirectory(currentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, currentPath]);

  const loadDirectory = (path) => {
    setLoading(true);
    executeCommand(`ls -la "${path}"`, ({ output }) => {
      try {
        const lines = output.split('\n').slice(1);
        const parsed = lines
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 9) {
              return {
                permissions: parts[0],
                owner: parts[2],
                group: parts[3],
                size: parts[4],
                date: `${parts[5]} ${parts[6]}`,
                name: parts.slice(8).join(' '),
                isDirectory: parts[0].startsWith('d'),
              };
            }
            return null;
          })
          .filter(Boolean);
        setFiles(parsed);
      } catch (error) {
        console.error('Error parsing directory:', error);
      } finally {
        setLoading(false);
      }
    });
  };

  const navigate = (name) => {
    if (name === '..') {
      const parent = currentPath === '/' ? '/' : currentPath.split('/').slice(0, -1).join('/') || '/';
      setCurrentPath(parent);
    } else {
      const nextPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      setCurrentPath(nextPath);
    }
  };

  const goToParent = () => {
    if (currentPath !== '/') {
      navigate('..');
    }
  };

  // Breadcrumbs logic:
  const pathSections = currentPath === '/'
    ? [{ label: '/', path: '/' }]
    : [
        { label: '/', path: '/' },
        ...currentPath
          .split('/')
          .filter(Boolean)
          .map((part, idx, arr) => ({
            label: part,
            path: '/' + arr.slice(0, idx + 1).join('/'),
          })),
      ];

  const handleCrumbClick = (idx) => {
    if (idx === 0) {
      setCurrentPath('/');
    } else {
      setCurrentPath(pathSections[idx].path);
    }
  };

  if (!sessionReady) {
    return <div className="flex items-center justify-center h-full">Loading filesystem...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b flex items-center space-x-4">
        {/* Hamburger Menu Button with icon */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded hover:bg-gray-200 focus:outline-none"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={24} />
        </button>

        {/* Breadcrumb Path */}
        <div className="flex items-center font-mono">
          {pathSections.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              <button
                type="button"
                onClick={() => handleCrumbClick(idx)}
                disabled={idx === pathSections.length - 1}
                className={`px-1 py-0.5 rounded ${
                  idx === pathSections.length - 1
                    ? "text-black font-semibold bg-gray-100"
                    : "text-blue-700 hover:underline"
                }`}
                style={{ cursor: idx === pathSections.length - 1 ? 'default' : 'pointer' }}
              >
                {crumb.label}
              </button>
              {idx !== pathSections.length - 1 && <span>/</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Go to Previous Directory Button */}
        <button
          disabled={currentPath === '/'}
          onClick={goToParent}
          className="ml-auto px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
          title="Go to Previous Directory"
        >
          Up
        </button>

        {/* Refresh Button */}
        <button
          disabled={loading}
          onClick={() => loadDirectory(currentPath)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <div className="overflow-auto flex-1 p-4">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th>Name</th>
              <th>Size</th>
              <th>Owner</th>
              <th>Permissions</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {currentPath !== '/' && (
              <tr className="cursor-pointer hover:bg-gray-200" onClick={() => navigate('..')}>
                <td colSpan={5} className="italic font-mono">.. (Parent Directory)</td>
              </tr>
            )}
            {files.map(({ name, size, owner, permissions, date, isDirectory }, idx) => (
              <tr
                key={idx}
                className={`${isDirectory ? 'cursor-pointer hover:bg-blue-100' : 'hover:bg-gray-100'}`}
                onClick={() => { if (isDirectory) navigate(name); }}
              >
                <td>{name}</td>
                <td>{isDirectory ? '-' : size}</td>
                <td>{owner}</td>
                <td>{permissions}</td>
                <td>{date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
