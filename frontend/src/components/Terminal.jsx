import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useSshSession } from '../hooks/useSshSession';
import '@xterm/xterm/css/xterm.css';

export default function TerminalComponent() {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const { sessionReady, subscribeToTerminal, sendTerminalInput, resizeTerminal } = useSshSession();

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 10000,
      tabStopWidth: 4,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#ffffff40',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    // Initialize addons
    fitAddon.current = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(webLinksAddon);

    // Open terminal
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Handle terminal input
    const handleTerminalInput = (data) => {
      if (sessionReady) {
        sendTerminalInput(data);
      }
    };
    terminal.current.onData(handleTerminalInput);

    // Subscribe to terminal data from SSH session
    const unsubscribe = subscribeToTerminal((data) => {
      if (terminal.current) {
        terminal.current.write(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddon.current && terminal.current && sessionReady) {
        fitAddon.current.fit();
        resizeTerminal(terminal.current.cols, terminal.current.rows);
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial resize
    if (sessionReady) {
      resizeTerminal(terminal.current.cols, terminal.current.rows);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unsubscribe) unsubscribe();
      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
    };
  }, [sessionReady, subscribeToTerminal, sendTerminalInput, resizeTerminal]);

  return (
    <div className="h-full bg-gray-900">
      {!sessionReady ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Waiting for SSH session...</p>
          </div>
        </div>
      ) : (
        <div ref={terminalRef} className="h-full w-full" />
      )}
    </div>
  );
}
