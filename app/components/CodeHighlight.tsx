import React, { useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prism-themes/themes/prism-atom-dark.css';

interface CodeHighlightProps {
  code: string;
}

const CodeHighlight: React.FC<CodeHighlightProps> = ({ code }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [code]);

  return (
    <div className="overflow-x-auto">
      <pre className="!bg-[#1e1e1e] !m-0 text-xs sm:text-sm">
        <code className="language-python">{code}</code>
      </pre>
    </div>
  );
};

export default CodeHighlight; 