import React from 'react';
import { Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ToolCallItem } from '../types';

interface ToolCallBadgeProps {
  tool: ToolCallItem;
}

export const ToolCallBadge: React.FC<ToolCallBadgeProps> = ({ tool }) => {
  const isPending = tool.status === 'calling' || tool.status === 'executing';
  const isSuccess = tool.status === 'success';
  const isError = tool.status === 'error';

  return (
    <div
      data-testid="tool-call-badge"
      className="my-2 rounded-md border border-[#30363d] bg-[#0d1117] text-xs font-mono overflow-hidden shadow-sm"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center space-x-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-gray-200">Tool: {tool.name}</span>
        </div>

        <div className="flex items-center space-x-1">
          {isPending && (
            <span className="inline-flex items-center space-x-1 text-[11px] text-blue-400 font-sans">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>executing</span>
            </span>
          )}
          {isSuccess && (
            <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-400 font-sans">
              <CheckCircle2 className="w-3 h-3" />
              <span>success</span>
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center space-x-1 text-[11px] text-red-400 font-sans">
              <XCircle className="w-3 h-3" />
              <span>failed</span>
            </span>
          )}
        </div>
      </div>

      {/* Body: Arguments & Result */}
      <div className="p-2.5 space-y-1.5 bg-[#0d1117]/80">
        <div>
          <div className="text-[10px] text-gray-500 font-sans uppercase tracking-wider mb-0.5">Parameters</div>
          <pre className="text-[11px] text-blue-300 bg-[#161b22] p-1.5 rounded border border-[#30363d]/60 overflow-x-auto">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </div>

        {tool.result !== undefined && (
          <div>
            <div className="text-[10px] text-gray-500 font-sans uppercase tracking-wider mb-0.5">Result</div>
            <pre className="text-[11px] text-emerald-300 bg-[#161b22] p-1.5 rounded border border-[#30363d]/60 overflow-x-auto">
              {JSON.stringify(tool.result, null, 2)}
            </pre>
          </div>
        )}

        {tool.error && (
          <div>
            <div className="text-[10px] text-red-400 font-sans uppercase tracking-wider mb-0.5">Error</div>
            <pre className="text-[11px] text-red-300 bg-red-950/40 p-1.5 rounded border border-red-800/40 overflow-x-auto">
              {tool.error}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
