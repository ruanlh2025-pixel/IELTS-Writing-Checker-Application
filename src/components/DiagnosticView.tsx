import React, { useState, useMemo } from 'react';
import { ValidatedAnnotation } from '../utils/annotationUtils';
import { X, CheckCircle2, AlertCircle, Sparkles, Lightbulb, Wand2 } from 'lucide-react';

interface DiagnosticViewProps {
  text: string;
  annotations: ValidatedAnnotation[];
  onAnnotationClick: (annotation: ValidatedAnnotation) => void;
  activeAnnotationId: string | null;
  onApplyChanges?: () => void;
}

export default function DiagnosticView({ text, annotations, onAnnotationClick, activeAnnotationId, onApplyChanges }: DiagnosticViewProps) {
  const chunks = useMemo(() => {
    const result: { text: string; annotation?: ValidatedAnnotation }[] = [];
    let currentIndex = 0;

    for (const ann of annotations) {
      const [start, end] = ann.validRange;
      
      if (start > currentIndex) {
        result.push({ text: text.substring(currentIndex, start) });
      }
      
      result.push({ text: text.substring(start, end), annotation: ann });
      currentIndex = end;
    }

    if (currentIndex < text.length) {
      result.push({ text: text.substring(currentIndex) });
    }

    return result;
  }, [text, annotations]);

  const getHighlightColor = (type: string, isActive: boolean) => {
    switch (type) {
      case 'Red':
        return isActive ? 'bg-red-200 border-b-2 border-red-500 text-red-900' : 'bg-red-100/50 border-b-2 border-red-300 hover:bg-red-100 cursor-pointer';
      case 'Blue':
        return isActive ? 'bg-blue-200 border-b-2 border-blue-500 text-blue-900' : 'bg-blue-100/50 border-b-2 border-blue-300 hover:bg-blue-100 cursor-pointer';
      case 'Yellow':
        return isActive ? 'bg-yellow-200 border-b-2 border-yellow-500 text-yellow-900' : 'bg-yellow-100/50 border-b-2 border-yellow-400 hover:bg-yellow-100 cursor-pointer';
      case 'Green':
        return isActive ? 'bg-green-200 border-b-2 border-green-500 text-green-900' : 'bg-green-100/50 border-b-2 border-green-400 hover:bg-green-100 cursor-pointer';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {onApplyChanges && annotations.some(a => a.type !== 'Green') && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onApplyChanges}
            className="flex items-center gap-2 px-4 py-2 bg-[#B3E5FC] text-[#01579B] hover:bg-[#81D4FA] rounded-lg shadow-sm hover:shadow-md transition-all text-sm font-medium"
          >
            <Wand2 className="w-4 h-4" />
            一键应用所有修改 (TDD 测试)
          </button>
        </div>
      )}
      <div className="flex-1 text-lg leading-loose font-serif text-[#424242] whitespace-pre-wrap overflow-y-auto">
        {chunks.map((chunk, i) => {
          if (chunk.annotation) {
            const isActive = activeAnnotationId === chunk.annotation.id;
            return (
              <span
                key={i}
                onClick={() => onAnnotationClick(chunk.annotation!)}
                className={`transition-colors duration-200 rounded-sm px-0.5 ${getHighlightColor(chunk.annotation.type, isActive)}`}
              >
                {chunk.text}
              </span>
            );
          }
          return <span key={i}>{chunk.text}</span>;
        })}
      </div>
    </div>
  );
}

interface DiagnosticCardProps {
  annotation: ValidatedAnnotation;
  onClose: () => void;
}

export function DiagnosticCard({ annotation, onClose }: DiagnosticCardProps) {
  const getIcon = () => {
    switch (annotation.type) {
      case 'Red': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'Blue': return <Sparkles className="w-5 h-5 text-blue-500" />;
      case 'Yellow': return <Lightbulb className="w-5 h-5 text-yellow-500" />;
      case 'Green': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default: return null;
    }
  };

  const getHeaderColor = () => {
    switch (annotation.type) {
      case 'Red': return 'bg-red-50 border-red-100';
      case 'Blue': return 'bg-blue-50 border-blue-100';
      case 'Yellow': return 'bg-yellow-50 border-yellow-100';
      case 'Green': return 'bg-green-50 border-green-100';
      default: return 'bg-[#FAFAFA] border-[#E0E0E0]';
    }
  };

  const getTitle = () => {
    switch (annotation.type) {
      case 'Red': return 'Critical Error (语法死穴)';
      case 'Blue': return 'Lexical Upgrade (词汇升级)';
      case 'Yellow': return 'Logic & Coherence (逻辑与衔接)';
      case 'Green': return 'Excellent Usage (地道表达)';
      default: return 'Feedback';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-[#E0E0E0] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col max-h-[70vh]">
      <div className={`px-4 py-3 flex items-center justify-between border-b shrink-0 ${getHeaderColor()}`}>
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="font-semibold text-gray-800">{getTitle()}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-white/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {annotation.type !== 'Green' && (
          <div className="flex flex-col gap-2 bg-[#FAFAFA] p-3 rounded-lg border border-[#E0E0E0] shrink-0">
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1 w-12 shrink-0">修改前</span>
              <span className="text-gray-500 line-through font-serif">{annotation.original}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-1 w-12 shrink-0">修改后</span>
              <span className="text-gray-900 font-bold font-serif">{annotation.replacement}</span>
            </div>
          </div>
        )}
        
        {annotation.type === 'Green' && (
          <div className="flex flex-col gap-2 bg-green-50/50 p-3 rounded-lg border border-green-100 shrink-0">
            <span className="text-green-900 font-bold font-serif">{annotation.original}</span>
          </div>
        )}

        <div className="text-sm text-gray-700 leading-relaxed">
          {annotation.explanation_zh}
        </div>
      </div>
    </div>
  );
}
