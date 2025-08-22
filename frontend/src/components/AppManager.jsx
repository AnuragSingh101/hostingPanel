import React, { useState, useEffect } from 'react';
import { useSshSession } from '../hooks/useSshSession';

export default function AppManager() {
  const { sessionReady, executeCommand } = useSshSession();
  const [processes, setProcesses] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('processes');

  useEffect(() => {
    if (sessionReady) {
      if (activeTab === 'processes') {
        loadProcesses();
      } else {
        loadServices();
      }
    }
  }, [sessionReady, activeTab]);

  const loadProcesses = () => {
    setLoading(true);
    executeCommand('ps aux --sort=-%cpu | head -20', (result) => {
      try {
        const lines = result.output.split('\n').slice(1);
        const parsedProcesses = lines
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11) {
              return {
                user: parts[0],
                pid: parts[7],
                cpu: parts[1],
                mem: parts[2],
                vsz: parts[3],
                rss: parts[4],
                tty: parts[5],
                stat: parts[6],
                start: parts[8],
                time: parts[9],
                command: parts.slice(10).join(' '),
              };
            }
            return null;
          })
          .filter(Boolean);
        
        setProcesses(parsedProcesses);
      } catch (error) {
        console.error('Error parsing processes:', error);
      }
      setLoading(false);
    });
  };

  const loadServices = () => {
    setLoading(true);
    executeCommand('systemctl list-units --type=service --state=running --no-pager', (result) => {
      try {
        const lines = result.output.split('\n').slice(1);
        const parsedServices = lines
          .filter(line => line.includes('.service'))
          .map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              return {
                unit: parts[0],
                load: parts[7],
                active: parts[1],
                sub: parts[2],
                description: parts.slice(4).join(' '),
              };
            }
            return null;
          })
          .filter(Boolean);
        
        setServices(parsedServices);
      } catch (error) {
        console.error('Error parsing services:', error);
      }
      setLoading(false);
    });
  };

  const killProcess = (pid) => {
    if (confirm(`Are you sure you want to kill process ${pid}?`)) {
      executeCommand(`kill ${pid}`, (result) => {
        if (result.code === 0) {
          loadProcesses();
        } else {
          alert('Failed to kill process');
        }
      });
    }
  };

  const toggleService = (serviceName, action) => {
    executeCommand(`sudo systemctl ${action} ${serviceName}`, (result) => {
      if (result.code === 0) {
        loadServices();
      } else {
        alert(`Failed to ${action} service`);
      }
    });
  };

  if (!sessionReady) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Waiting for SSH session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {[
            { id: 'processes', name: 'Processes' },
            { id: 'services', name: 'Services' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'processes' ? (
          <div>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">Running Processes</h3>
              <button
                onClick={loadProcesses}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU%</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MEM%</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Command</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processes.map((process, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">{process.pid}</td>
                    <td className="px-4 py-3 text-sm">{process.user}</td>
                    <td className="px-4 py-3 text-sm">{process.cpu}%</td>
                    <td className="px-4 py-3 text-sm">{process.mem}%</td>
                    <td className="px-4 py-3 text-sm font-mono truncate max-w-xs">{process.command}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => killProcess(process.pid)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">System Services</h3>
              <button
                onClick={loadServices}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Load</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sub</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {services.map((service, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">{service.unit}</td>
                    <td className="px-4 py-3 text-sm">{service.load}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        service.active === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {service.active}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{service.sub}</td>
                    <td className="px-4 py-3 text-sm truncate max-w-xs">{service.description}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button
                        onClick={() => toggleService(service.unit, 'restart')}
                        className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                      >
                        Restart
                      </button>
                      <button
                        onClick={() => toggleService(service.unit, 'stop')}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Stop
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
