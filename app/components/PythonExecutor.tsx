'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface PythonExecutorProps {
  code: string;
  data: any[];
}

const PythonExecutor: React.FC<PythonExecutorProps> = ({ code, data }) => {
  const [chartImage, setChartImage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [pyodideLoaded, setPyodideLoaded] = useState<boolean>(false);

  // Load Pyodide script once
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
    script.async = true;
    script.onload = () => setPyodideLoaded(true);
    document.body.appendChild(script);
    return () => void document.body.removeChild(script);
  }, []);

  // Execute Python when code, data or Pyodide availability changes
  useEffect(() => {
    const execute = async () => {
      if (!pyodideLoaded || !code) return;
      setLoading(true);
      setError('');
      try {
        // @ts-ignore
        const pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/' });
        await pyodide.loadPackage(['matplotlib', 'numpy', 'pandas']);
        pyodide.globals.set('data', data);
        const result: string = await pyodide.runPythonAsync(code);
        setChartImage(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error executing Python code');
      } finally {
        setLoading(false);
      }
    };
    execute();
  }, [code, data, pyodideLoaded]);

  return (
    <div className="mt-4 border border-green-500 p-2">
      <p className="text-xs text-green-500">[PythonExecutor Mounted Here]</p>
      {error ? ( 
        <p className="text-red-500">{error}</p>
      ) : loading ? ( 
        <p className="text-yellow-500">Loading...</p>
      ) : chartImage ? (
        <img src={chartImage} alt="Chart" />
      ) : null}
    </div>
  );
  
};

export default dynamic(() => Promise.resolve(PythonExecutor), { ssr: false });
