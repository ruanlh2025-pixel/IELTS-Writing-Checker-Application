/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Play, RotateCcw, FileText, BarChart, PenTool, BookOpen, Pause, CheckCircle2, AlertCircle, Loader2, ChevronRight, Calculator } from 'lucide-react';
import { generateOfficialScore, ScoringResult, calculateFinalWritingScore, generateDiagnostics, generateModelEssay, ModelEssayResult } from './services/scoringService';
import ScoreReport from './components/ScoreReport';
import DiagnosticView, { DiagnosticCard } from './components/DiagnosticView';
import ModelEssayView from './components/ModelEssayView';
import { validateAnnotations, ValidatedAnnotation } from './utils/annotationUtils';

// --- Analytics Mock ---
const logAnalytics = (eventName: string, data: any) => {
  console.log(`[Analytics] ${eventName}`, data);
};

export default function App() {
  // --- State ---
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task1');
  
  // Separate states for Task 1 and Task 2
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');
  const [task1Result, setTask1Result] = useState<ScoringResult | null>(null);
  const [task2Result, setTask2Result] = useState<ScoringResult | null>(null);
  const [task1UnlockedStep, setTask1UnlockedStep] = useState<1 | 2 | 3 | 4>(1);
  const [task2UnlockedStep, setTask2UnlockedStep] = useState<1 | 2 | 3 | 4>(1);
  
  const [task1Annotations, setTask1Annotations] = useState<ValidatedAnnotation[] | null>(null);
  const [task2Annotations, setTask2Annotations] = useState<ValidatedAnnotation[] | null>(null);
  const [task1ActiveAnnotationId, setTask1ActiveAnnotationId] = useState<string | null>(null);
  const [task2ActiveAnnotationId, setTask2ActiveAnnotationId] = useState<string | null>(null);

  const [task1ModelEssay, setTask1ModelEssay] = useState<ModelEssayResult | null>(null);
  const [task2ModelEssay, setTask2ModelEssay] = useState<ModelEssayResult | null>(null);

  // Derived state for current task
  const text = taskType === 'task1' ? task1Text : task2Text;
  const setText = (newText: string) => taskType === 'task1' ? setTask1Text(newText) : setTask2Text(newText);
  const currentResult = taskType === 'task1' ? task1Result : task2Result;
  const setCurrentResult = (res: ScoringResult | null) => taskType === 'task1' ? setTask1Result(res) : setTask2Result(res);
  const unlockedStep = taskType === 'task1' ? task1UnlockedStep : task2UnlockedStep;
  const setUnlockedStep = (step: 1 | 2 | 3 | 4) => taskType === 'task1' ? setTask1UnlockedStep(step) : setTask2UnlockedStep(step);
  
  const currentAnnotations = taskType === 'task1' ? task1Annotations : task2Annotations;
  const setCurrentAnnotations = (anns: ValidatedAnnotation[] | null) => taskType === 'task1' ? setTask1Annotations(anns) : setTask2Annotations(anns);
  const activeAnnotationId = taskType === 'task1' ? task1ActiveAnnotationId : task2ActiveAnnotationId;
  const setActiveAnnotationId = (id: string | null) => taskType === 'task1' ? setTask1ActiveAnnotationId(id) : setTask2ActiveAnnotationId(id);
  const activeAnnotation = currentAnnotations?.find(a => a.id === activeAnnotationId) || null;

  const currentModelEssay = taskType === 'task1' ? task1ModelEssay : task2ModelEssay;
  const setCurrentModelEssay = (essay: ModelEssayResult | null) => taskType === 'task1' ? setTask1ModelEssay(essay) : setTask2ModelEssay(essay);

  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [timerActive, setTimerActive] = useState(false);
  
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2 | 3>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Toast state
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  // --- Effects ---
  useEffect(() => {
    let interval: any = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  useEffect(() => {
    let interval: any = null;
    if (cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // --- Handlers ---
  const showToast = (msg: string, type: 'error' | 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleTaskSwitch = (newTask: 'task1' | 'task2') => {
    if (taskType !== newTask) {
      setTaskType(newTask);
      logAnalytics('switch_task', { from: taskType, to: newTask });
      setLoadingStep(0);
      setToast(null);
    }
  };

  const toggleTimer = () => setTimerActive(!timerActive);
  const resetTimer = () => {
    setTimerActive(false);
    setTimeLeft(3600);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- Validation Logic (Enhanced TDD Cases) ---
  const validateSubmission = () => {
    const timeSpent = 3600 - timeLeft;
    const usageMode = (taskType === 'task1' && task2Result) || (taskType === 'task2' && task1Result) ? 'full' : 'single';

    // Case 1: Empty protection
    if (wordCount === 0) {
      showToast("老师提醒：作文框还是空的，请粘贴内容。", "error");
      logAnalytics('submit_essay', { total_word_count: wordCount, time_spent: timeSpent, pass_validation_status: false, reason: 'empty', usage_mode: usageMode });
      return false;
    }

    // Case 2: Language purity check (Chinese characters)
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    if (hasChinese) {
      showToast("无法识别，请确保您粘贴的是雅思英文作文，不能包含中文字符。", "error");
      logAnalytics('submit_essay', { total_word_count: wordCount, time_spent: timeSpent, pass_validation_status: false, reason: 'contains_chinese', usage_mode: usageMode });
      return false;
    }

    // Case 3: Minimum submission limit
    if (taskType === 'task1' && wordCount < 20) {
      showToast("内容太少，AI 老师无法给出有意义的评分，请继续写作。", "error");
      logAnalytics('submit_essay', { total_word_count: wordCount, time_spent: timeSpent, pass_validation_status: false, reason: 'too_short_task1', usage_mode: usageMode });
      return false;
    }
    if (taskType === 'task2' && wordCount < 50) {
      showToast("内容太少，AI 老师无法给出有意义的评分，请继续写作。", "error");
      logAnalytics('submit_essay', { total_word_count: wordCount, time_spent: timeSpent, pass_validation_status: false, reason: 'too_short_task2', usage_mode: usageMode });
      return false;
    }

    logAnalytics('submit_essay', { total_word_count: wordCount, time_spent: timeSpent, pass_validation_status: true, usage_mode: usageMode });
    return true;
  };

  // --- Step Handlers ---
  const handleStep1Click = async () => {
    if (!validateSubmission() || loadingStep === 1 || cooldownRemaining > 0) return;
    setLoadingStep(1);
    try {
      const result = await generateOfficialScore(text, taskType);
      setCurrentResult(result);
      if (unlockedStep < 2) setUnlockedStep(2);
      showToast("官方评分生成成功！", "success");
    } catch (error: any) {
      console.error(error);
      try {
        const errData = JSON.parse(error.message);
        if (errData.type === 'RATE_LIMIT') {
          setCooldownRemaining(errData.retryDelay);
          showToast(`系统忙，请在 ${errData.retryDelay} 秒后重试`, "error");
        } else {
          showToast("生成评分失败，请稍后重试。", "error");
        }
      } catch (e) {
        showToast("生成评分失败，请稍后重试。", "error");
      }
    } finally {
      setLoadingStep(0);
    }
  };

  const handleStep2Click = async () => {
    if (unlockedStep < 2 || loadingStep === 2 || cooldownRemaining > 0) return;
    setLoadingStep(2);
    try {
      const rawAnnotations = await generateDiagnostics(text);
      const validAnnotations = validateAnnotations(text, rawAnnotations);
      setCurrentAnnotations(validAnnotations);
      if (unlockedStep < 3) setUnlockedStep(3);
      showToast("逐句划线诊断完成！", "success");
      logAnalytics('unlock_module', { module: 'step2_diagnostic' });
    } catch (error: any) {
      console.error(error);
      try {
        const errData = JSON.parse(error.message);
        if (errData.type === 'RATE_LIMIT') {
          setCooldownRemaining(errData.retryDelay);
          showToast(`系统忙，请在 ${errData.retryDelay} 秒后重试`, "error");
        } else {
          showToast("生成诊断失败，请稍后重试。", "error");
        }
      } catch (e) {
        showToast("生成诊断失败，请稍后重试。", "error");
      }
    } finally {
      setLoadingStep(0);
    }
  };

  const handleStep3Click = async () => {
    if (unlockedStep < 3 || !currentResult || loadingStep === 3 || cooldownRemaining > 0) return;
    setLoadingStep(3);
    try {
      const modelEssay = await generateModelEssay(text, taskType, currentResult.overall_score);
      setCurrentModelEssay(modelEssay);
      if (unlockedStep < 4) setUnlockedStep(4);
      showToast("阶梯提分范文已获取！", "success");
      logAnalytics('unlock_module', { module: 'step3_sample_essay' });
    } catch (error: any) {
      console.error(error);
      try {
        const errData = JSON.parse(error.message);
        if (errData.type === 'RATE_LIMIT') {
          setCooldownRemaining(errData.retryDelay);
          showToast(`系统忙，请在 ${errData.retryDelay} 秒后重试`, "error");
        } else {
          showToast("生成范文失败，请稍后重试。", "error");
        }
      } catch (e) {
        showToast("生成范文失败，请稍后重试。", "error");
      }
    } finally {
      setLoadingStep(0);
    }
  };

  const handleApplyChanges = () => {
    if (!currentAnnotations) return;
    
    // Sort annotations by start index descending to avoid index shifting issues
    const sortedAnns = [...currentAnnotations]
      .filter(a => a.type !== 'Green')
      .sort((a, b) => b.validRange[0] - a.validRange[0]);
      
    let newText = text;
    for (const ann of sortedAnns) {
      const [start, end] = ann.validRange;
      newText = newText.substring(0, start) + ann.replacement + newText.substring(end);
    }
    
    setText(newText);
    setCurrentAnnotations(null);
    setActiveAnnotationId(null);
    setCurrentModelEssay(null);
    setUnlockedStep(1);
    setCurrentResult(null);
    showToast("已应用所有修改，请重新生成评分以验证提分效果。", "success");
    logAnalytics('apply_all_changes', { count: sortedAnns.length });
  };

  const handleApplyModelEssay = (essay: string) => {
    setText(essay);
    setCurrentAnnotations(null);
    setActiveAnnotationId(null);
    setCurrentModelEssay(null);
    setUnlockedStep(1);
    setCurrentResult(null);
    showToast("已应用范文内容，请重新生成评分以验证提分效果。", "success");
    logAnalytics('apply_model_essay', { taskType });
  };

  // --- UI Helpers ---
  const getWordCountColor = () => {
    if (taskType === 'task1') {
      if (wordCount < 150) return 'text-red-500';
      if (wordCount <= 200) return 'text-green-500';
      return 'text-orange-500';
    } else {
      if (wordCount < 250) return 'text-red-500';
      if (wordCount <= 350) return 'text-green-500';
      return 'text-orange-500';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#424242] font-sans relative">
      
      {/* Active Annotation Card (Mobile) */}
      <div className="lg:hidden">
        {activeAnnotation && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <DiagnosticCard 
                annotation={activeAnnotation} 
                onClose={() => setActiveAnnotationId(null)} 
              />
            </div>
            <div className="absolute inset-0 -z-10" onClick={() => setActiveAnnotationId(null)}></div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg border ${
            toast.type === 'error' ? 'bg-white border-red-100 text-red-600' : 'bg-white border-green-100 text-green-600'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="font-medium">{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#E0E0E0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#B3E5FC] rounded-lg flex items-center justify-center text-[#01579B] font-bold text-lg shadow-sm">
              A
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-[#01579B]">雅思 A 类写作 AI 助手</h1>
          </div>
          
          <div className="flex items-center gap-3 bg-[#FAFAFA] px-4 py-1.5 rounded-lg border border-[#E0E0E0]">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-lg font-mono font-medium w-14 text-center">
              {formatTime(timeLeft)}
            </span>
            <div className="flex gap-1 border-l border-[#E0E0E0] pl-2">
              <button 
                onClick={toggleTimer}
                className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-gray-600 transition-all"
                title={timerActive ? "暂停" : "开始"}
              >
                {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button 
                onClick={resetTimer}
                className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-gray-600 transition-all"
                title="重置"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Grid Layout for Desktop, Stacked for Mobile */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input Area */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {/* Task Switcher */}
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-[#E0E0E0] w-fit">
            <button
              onClick={() => handleTaskSwitch('task1')}
              className={`py-2 px-6 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                taskType === 'task1' 
                  ? 'bg-[#B3E5FC] text-[#01579B] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <BarChart className="w-4 h-4" />
              Task 1 (图表描述)
            </button>
            <button
              onClick={() => handleTaskSwitch('task2')}
              className={`py-2 px-6 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                taskType === 'task2' 
                  ? 'bg-[#B3E5FC] text-[#01579B] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Task 2 (议论文)
            </button>
          </div>

          {/* Editor Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E0E0E0] flex flex-col flex-1 min-h-[500px] relative">
            {loadingStep === 1 && (
              <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl">
                <Loader2 className="w-10 h-10 text-[#01579B] animate-spin mb-4" />
                <p className="text-[#01579B] font-medium animate-pulse">AI 考官正在根据官方标准（1-9分）进行深度评估...</p>
              </div>
            )}
            <div className="p-6 flex-1 flex flex-col">
              {unlockedStep >= 4 && currentModelEssay ? (
                <ModelEssayView
                  result={currentModelEssay}
                  originalText={text}
                  onCopy={() => logAnalytics('copy_model_essay_action', { taskType })}
                  onFeedback={(isUseful) => logAnalytics('model_essay_satisfaction', { taskType, isUseful })}
                  onTimeSpent={(seconds) => logAnalytics('essay_comparison_time', { taskType, seconds })}
                  onApplyModelEssay={handleApplyModelEssay}
                />
              ) : unlockedStep >= 3 && currentAnnotations ? (
                <DiagnosticView 
                  text={text} 
                  annotations={currentAnnotations} 
                  onAnnotationClick={(ann) => {
                    setActiveAnnotationId(ann.id);
                    logAnalytics('annotation_click', { type: ann.type });
                  }}
                  activeAnnotationId={activeAnnotationId}
                  onApplyChanges={handleApplyChanges}
                />
              ) : (
                <textarea
                  value={text}
                  onChange={handleTextChange}
                  placeholder="在此输入或粘贴您的雅思英文作文..."
                  className="w-full flex-1 resize-none outline-none text-lg leading-loose font-serif text-[#424242] placeholder-gray-300 bg-transparent"
                  spellCheck="false"
                />
              )}
            </div>
            
            {/* Footer / Word Count */}
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E0E0E0] rounded-b-2xl flex justify-between items-center text-sm">
              <div className="text-gray-500 font-medium">
                目标: {taskType === 'task1' ? '150 词' : '250 词'}
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-[#E0E0E0] shadow-sm">
                <span className="text-gray-500">当前词数</span>
                <span className={`font-bold text-base ${getWordCountColor()}`}>
                  {wordCount}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Feedback Modules */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Active Annotation Card (Desktop) */}
          <div className="hidden lg:block">
            {activeAnnotation && (
              <DiagnosticCard 
                annotation={activeAnnotation} 
                onClose={() => setActiveAnnotationId(null)} 
              />
            )}
          </div>

          {/* Combined Score Card */}
          {task1Result && task2Result && (
            <div className="bg-gradient-to-br from-[#B3E5FC] to-[#81D4FA] rounded-2xl shadow-md border border-[#81D4FA] p-6 text-[#01579B] animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Overall Band Score (30/70)
                  </h2>
                  <p className="text-[#0277BD] text-sm mt-1">Task 1 (30%) + Task 2 (70%)</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-white text-[#01579B] flex items-center justify-center text-2xl font-bold shadow-inner border border-[#B3E5FC]">
                  {calculateFinalWritingScore(task1Result.overall_score, task2Result.overall_score).toFixed(1)}
                </div>
              </div>
            </div>
          )}

          {/* Score Report */}
          {currentResult && (
            <ScoreReport result={currentResult} taskType={taskType} />
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-[#E0E0E0] p-6 flex flex-col gap-6">
            <h2 className="text-base font-semibold text-[#424242] flex items-center gap-2 border-b border-[#E0E0E0] pb-4">
              <PenTool className="w-5 h-5 text-[#01579B]" />
              AI 批改流程
            </h2>

            <div className="flex flex-col gap-4 relative">
              {/* Connecting Line */}
              <div className="absolute left-[1.15rem] top-8 bottom-8 w-0.5 bg-[#E0E0E0] z-0"></div>

              {/* Step 1 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 bg-white transition-colors ${
                  unlockedStep > 1 ? 'border-[#B3E5FC] text-[#01579B]' : 'border-[#B3E5FC] bg-[#B3E5FC] text-[#01579B]'
                }`}>
                  {unlockedStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold">1</span>}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-medium text-[#424242] mb-2">官方评分</h3>
                  <button
                    onClick={handleStep1Click}
                    disabled={loadingStep === 1 || cooldownRemaining > 0}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      loadingStep === 1 || cooldownRemaining > 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : unlockedStep > 1 
                          ? 'bg-[#E1F5FE] text-[#01579B] border border-[#B3E5FC] hover:bg-[#B3E5FC]'
                          : 'bg-[#B3E5FC] text-[#01579B] hover:bg-[#81D4FA] shadow-sm hover:shadow'
                    }`}
                  >
                    {cooldownRemaining > 0 ? (
                      `系统忙，请在 ${cooldownRemaining} 秒后重试`
                    ) : loadingStep === 1 ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> AI 老师正在阅读中（预计 10 秒）...</>
                    ) : (
                      unlockedStep > 1 ? '重新生成评分' : '生成官方评分'
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 bg-white transition-colors ${
                  unlockedStep > 2 ? 'border-[#B3E5FC] text-[#01579B]' : 
                  unlockedStep === 2 ? 'border-[#B3E5FC] bg-[#B3E5FC] text-[#01579B]' : 'border-[#E0E0E0] text-gray-400'
                }`}>
                  {unlockedStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold">2</span>}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className={`font-medium mb-2 transition-colors ${unlockedStep >= 2 ? 'text-[#424242]' : 'text-gray-400'}`}>
                    逐句诊断
                  </h3>
                  <button
                    onClick={handleStep2Click}
                    disabled={unlockedStep < 2 || loadingStep === 2 || cooldownRemaining > 0}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      loadingStep === 2 || cooldownRemaining > 0 || unlockedStep < 2
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : unlockedStep > 2 
                          ? 'bg-[#E1F5FE] text-[#01579B] border border-[#B3E5FC] hover:bg-[#B3E5FC]'
                          : 'bg-[#B3E5FC] text-[#01579B] hover:bg-[#81D4FA] shadow-sm hover:shadow'
                    }`}
                  >
                    {cooldownRemaining > 0 && unlockedStep >= 2 ? (
                      `系统忙，请在 ${cooldownRemaining} 秒后重试`
                    ) : loadingStep === 2 ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 正在诊断中...</>
                    ) : (
                      unlockedStep > 2 ? '重新诊断' : '逐句划线诊断'
                    )}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 bg-white transition-colors ${
                  unlockedStep > 3 ? 'border-[#B3E5FC] text-[#01579B]' : 
                  unlockedStep === 3 ? 'border-[#B3E5FC] bg-[#B3E5FC] text-[#01579B]' : 'border-[#E0E0E0] text-gray-400'
                }`}>
                  {unlockedStep > 3 ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold">3</span>}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className={`font-medium mb-2 transition-colors ${unlockedStep >= 3 ? 'text-[#424242]' : 'text-gray-400'}`}>
                    提分范文
                  </h3>
                  <button
                    onClick={handleStep3Click}
                    disabled={unlockedStep < 3 || loadingStep === 3 || cooldownRemaining > 0}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      loadingStep === 3 || cooldownRemaining > 0 || unlockedStep < 3
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : unlockedStep > 3 
                          ? 'bg-[#E1F5FE] text-[#01579B] border border-[#B3E5FC] hover:bg-[#B3E5FC]'
                          : 'bg-[#B3E5FC] text-[#01579B] hover:bg-[#81D4FA] shadow-sm hover:shadow'
                    }`}
                  >
                    {cooldownRemaining > 0 && unlockedStep >= 3 ? (
                      `系统忙，请在 ${cooldownRemaining} 秒后重试`
                    ) : loadingStep === 3 ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 正在生成范文...</>
                    ) : (
                      unlockedStep > 3 ? '重新生成范文' : '获取阶梯提分范文'
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

