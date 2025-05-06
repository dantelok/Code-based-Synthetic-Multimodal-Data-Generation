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
  const [loading, setLoading] = useState(true);
  const [pyodideLoaded, setPyodideLoaded] = useState(false);

  useEffect(() => {
    // Load Pyodide script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
    script.async = true;
    script.onload = () => setPyodideLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const executePython = async () => {
      if (!pyodideLoaded || !code) return;

      try {
        setLoading(true);
        // @ts-ignore - Pyodide is loaded globally
        const pyodide = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });

        // Load required packages
        await pyodide.loadPackage(['matplotlib', 'numpy']);

        // Set up the data in Python environment
        pyodide.globals.set('data', data);

        // Execute the code
        const result = await pyodide.runPythonAsync(code);
        setChartImage(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error executing Python code');
      } finally {
        setLoading(false);
      }
    };

    executePython();
  }, [code, data, pyodideLoaded]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Generating chart...</span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {chartImage && (
        <img src={chartImage} alt="Generated chart" className="max-w-full rounded-md border border-[#444] bg-[#18181c]" />
      )}
    </div>
  );
};

// Export as a dynamic component with no SSR
export default dynamic(() => Promise.resolve(PythonExecutor), { ssr: false }); 