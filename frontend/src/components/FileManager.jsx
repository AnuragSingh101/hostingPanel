import React, { useState, useEffect } from 'react';
import { useSshSession } from '../hooks/useSshSession';

export default function FileManager() {
  const { sessionReady, executeCommand } = useSshSession();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionReady) {
      loadDirectory(currentPath);
    }
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
                owner: parts,
                group: parts,
                size: parts,
                date: `${parts} ${parts}`,
                name: parts.slice(8).join(' '),
                isDirectory: parts.startsWith('d'),
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

  if (!sessionReady) {
    return <div className="flex items-center justify-center h-full">Loading filesystem...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b flex items-center">
        <span className="font-mono">{currentPath}</span>
        <button onClick={() => loadDirectory(currentPath)} disabled={loading} className="ml-auto btn-primary">
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
              <tr key={idx}
                  className={`${isDirectory ? 'cursor-pointer hover:bg-blue-100' : 'hover:bg-gray-100'}`}
                  onClick={() => { if (isDirectory) navigate(name); }}>
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
