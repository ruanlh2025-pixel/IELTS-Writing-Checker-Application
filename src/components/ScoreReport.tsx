import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ScoringResult } from '../services/scoringService';

interface ScoreReportProps {
  result: ScoringResult;
  taskType: 'task1' | 'task2';
}

const COLORS = ['#81D4FA', '#4FC3F7', '#29B6F6', '#03A9F4'];

export default function ScoreReport({ result, taskType }: ScoreReportProps) {
  const data = [
    { name: taskType === 'task1' ? 'TA' : 'TR', score: result.ta_tr_score, full: taskType === 'task1' ? 'Task Achievement' : 'Task Response' },
    { name: 'CC', score: result.cc_score, full: 'Coherence & Cohesion' },
    { name: 'LR', score: result.lr_score, full: 'Lexical Resource' },
    { name: 'GRA', score: result.gra_score, full: 'Grammatical Range & Accuracy' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E0E0E0] p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-4">
        <h2 className="text-lg font-semibold text-[#424242]">官方评分报告</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Overall Band Score</span>
          <div className="w-12 h-12 rounded-full bg-[#B3E5FC] text-[#01579B] flex items-center justify-center text-xl font-bold shadow-md">
            {result.overall_score.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} />
            <YAxis domain={[0, 9]} ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]} axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip 
              cursor={{ fill: '#F3F4F6' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              formatter={(value: number, name: string, props: any) => [value, props.payload.full]}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E0E0E0]">
          <h3 className="font-semibold text-[#0F172A] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#81D4FA]"></span>
            {taskType === 'task1' ? 'Task Achievement (TA)' : 'Task Response (TR)'} - {result.ta_tr_score.toFixed(1)}
          </h3>
          <p className="text-sm text-[#475569] leading-relaxed">{result.ta_tr_feedback}</p>
        </div>
        
        <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E0E0E0]">
          <h3 className="font-semibold text-[#0F172A] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4FC3F7]"></span>
            Coherence & Cohesion (CC) - {result.cc_score.toFixed(1)}
          </h3>
          <p className="text-sm text-[#475569] leading-relaxed">{result.cc_feedback}</p>
        </div>

        <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E0E0E0]">
          <h3 className="font-semibold text-[#0F172A] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#29B6F6]"></span>
            Lexical Resource (LR) - {result.lr_score.toFixed(1)}
          </h3>
          <p className="text-sm text-[#475569] leading-relaxed">{result.lr_feedback}</p>
        </div>

        <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E0E0E0]">
          <h3 className="font-semibold text-[#0F172A] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#03A9F4]"></span>
            Grammatical Range & Accuracy (GRA) - {result.gra_score.toFixed(1)}
          </h3>
          <p className="text-sm text-[#475569] leading-relaxed">{result.gra_feedback}</p>
        </div>
      </div>
    </div>
  );
}
