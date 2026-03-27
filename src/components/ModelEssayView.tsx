import React, { useState, useEffect, useRef } from 'react';
import { ModelEssayResult } from '../services/scoringService';
import { Copy, ThumbsUp, ThumbsDown, Check, Sparkles, FileText, ArrowRightLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ModelEssayViewProps {
  result: ModelEssayResult;
  originalText: string;
  onCopy: () => void;
  onFeedback: (isUseful: boolean) => void;
  onTimeSpent: (seconds: number) => void;
  onApplyModelEssay: (essay: string) => void;
}

export default function ModelEssayView({ result, originalText, onCopy, onFeedback, onTimeSpent, onApplyModelEssay }: ModelEssayViewProps) {
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'useful' | 'not_useful' | null>(null);
  const [viewMode, setViewMode] = useState<'model' | 'compare'>('model');
  const compareStartTime = useRef<number | null>(null);
  const totalCompareTime = useRef(0);

  useEffect(() => {
    if (viewMode === 'compare') {
      compareStartTime.current = Date.now();
    } else {
      if (compareStartTime.current) {
        totalCompareTime.current += Math.floor((Date.now() - compareStartTime.current) / 1000);
        compareStartTime.current = null;
      }
    }
  }, [viewMode]);

  useEffect(() => {
    return () => {
      // On unmount, if currently in compare mode, add the time
      let finalTime = totalCompareTime.current;
      if (compareStartTime.current) {
        finalTime += Math.floor((Date.now() - compareStartTime.current) / 1000);
      }
      if (finalTime > 0) {
        onTimeSpent(finalTime);
      }
    };
  }, [onTimeSpent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.essay.replace(/\*\*/g, ''));
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (isUseful: boolean) => {
    if (feedbackGiven) return;
    setFeedbackGiven(isUseful ? 'useful' : 'not_useful');
    onFeedback(isUseful);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            目标 {result.targetScore} 分范文
          </h3>
          <div className="flex bg-[#FAFAFA] border border-[#E0E0E0] p-1 rounded-lg">
            <button
              onClick={() => setViewMode('model')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'model' ? 'bg-white shadow-sm text-[#01579B]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText className="w-4 h-4" />
              范文展示
            </button>
            <button
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'compare' ? 'bg-white shadow-sm text-[#01579B]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              原文对比
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-[#E0E0E0] rounded-lg hover:bg-[#FAFAFA] transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制范文'}
          </button>
          <button
            onClick={() => onApplyModelEssay(result.essay.replace(/\*\*/g, ''))}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#01579B] bg-[#E1F5FE] border border-[#B3E5FC] rounded-lg hover:bg-[#B3E5FC] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            使用范文重新评分
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-2">
        {viewMode === 'model' ? (
          <div className="bg-white p-6 rounded-xl border border-[#B3E5FC] shadow-sm">
            <div className="prose prose-blue max-w-none font-serif text-lg leading-loose text-gray-800">
              <ReactMarkdown
                components={{
                  strong: ({node, ...props}) => <strong className="text-[#01579B] bg-[#E1F5FE] px-1 rounded border-b-2 border-[#B3E5FC]" {...props} />
                }}
              >
                {result.essay}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[400px]">
            <div className="bg-[#FAFAFA] p-6 rounded-xl border border-[#E0E0E0] flex flex-col">
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 shrink-0">您的原文</h4>
              <div className="font-serif text-lg leading-loose text-gray-600 whitespace-pre-wrap overflow-y-auto flex-1">
                {originalText}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-[#81D4FA] shadow-sm flex flex-col">
              <h4 className="text-sm font-bold text-[#01579B] uppercase tracking-wider mb-4 shrink-0">提分范文</h4>
              <div className="prose prose-blue max-w-none font-serif text-lg leading-loose text-gray-800 overflow-y-auto flex-1">
                <ReactMarkdown
                  components={{
                    strong: ({node, ...props}) => <strong className="text-[#01579B] bg-[#E1F5FE] px-1 rounded border-b-2 border-[#81D4FA]" {...props} />
                  }}
                >
                  {result.essay}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-[#E1F5FE] to-[#B3E5FC] p-6 rounded-xl border border-[#B3E5FC] shrink-0">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#01579B]" />
            关键提分动作
          </h4>
          <ul className="space-y-4">
            {result.improvements.map((imp, idx) => {
              const [action, ...desc] = imp.split('：');
              return (
                <li key={idx} className="flex items-start gap-3 text-gray-700">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#B3E5FC] text-[#01579B] flex items-center justify-center text-sm font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="leading-relaxed">
                    {desc.length > 0 ? (
                      <>
                        <span className="font-semibold text-gray-900">{action}：</span>
                        {desc.join('：')}
                      </>
                    ) : (
                      imp
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center py-6 border-t border-[#E0E0E0] gap-3 shrink-0">
          <p className="text-sm text-gray-500">这篇范文对您有帮助吗？</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleFeedback(true)}
              disabled={feedbackGiven !== null}
              className={`flex items-center gap-2 px-6 py-2 rounded-full border transition-all ${
                feedbackGiven === 'useful' 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : feedbackGiven === 'not_useful'
                    ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] border-[#E0E0E0]'
                    : 'bg-white border-[#E0E0E0] text-gray-600 hover:bg-[#FAFAFA] hover:border-gray-300'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              有用
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={feedbackGiven !== null}
              className={`flex items-center gap-2 px-6 py-2 rounded-full border transition-all ${
                feedbackGiven === 'not_useful' 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : feedbackGiven === 'useful'
                    ? 'opacity-50 cursor-not-allowed bg-[#FAFAFA] border-[#E0E0E0]'
                    : 'bg-white border-[#E0E0E0] text-gray-600 hover:bg-[#FAFAFA] hover:border-gray-300'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              没用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
