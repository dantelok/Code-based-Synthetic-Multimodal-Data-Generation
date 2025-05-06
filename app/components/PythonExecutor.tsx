'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

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
    <div className="mt-4 p-2">
      {error ? ( 
        <p className="text-red-500">{error}</p>
      ) : loading ? ( 
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#b13131]" />
          <span className="text-[#b13131]">Generating chart...</span>
        </div>
      ) : chartImage ? (
        <img src={chartImage} alt="Chart" className="w-full rounded-lg shadow-lg" />
      ) : null}
    </div>
  );
};

export default dynamic(() => Promise.resolve(PythonExecutor), { ssr: false });
