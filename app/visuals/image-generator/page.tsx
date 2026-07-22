import React from 'react';
import { 
  Play, Pause, Square, AlertOctagon, 
  Activity, Server, Image as ImageIcon,
  CheckCircle2, AlertCircle, Clock, ChevronRight
} from 'lucide-react';

export default function ImageGeneratorWorkspace() {
  return (
    <div className="flex h-full flex-col">
      {/* Workspace Header & Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Autonomous Image Generator</h1>
          <div className="flex items-center text-sm text-slate-500 mt-1 space-x-2">
            <span className="flex items-center"><Activity className="w-4 h-4 mr-1 text-emerald-500" /> System Online</span>
            <span>&bull;</span>
            <span>Queue: 42 Pending</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button className="inline-flex items-center px-3 py-2 border border-slate-200 shadow-sm text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Play className="w-4 h-4 mr-2" />
            Start Engine
          </button>
          <div className="w-px h-8 bg-slate-200 mx-2"></div>
          <button className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
            <AlertOctagon className="w-4 h-4 mr-2" />
            Emergency Stop
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-hidden flex">
        
        {/* Left Column: Context & State */}
        <div className="w-1/3 border-r border-slate-200 bg-slate-50/50 flex flex-col overflow-y-auto">
          
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Active Job</h2>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  SCENE-042-B
                </span>
                <span className="text-xs text-slate-500">Attempt 1/3</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Lagos Island Market establishing shot</h3>
              <p className="text-sm text-slate-600 mt-2 line-clamp-3">
                Wide establishing shot of Balogun market during early morning. Bright natural lighting, 
                dense crowds. Focus on architectural continuity and accurate 2024 transportation patterns.
              </p>
            </div>
          </div>

          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Lifecycle State</h2>
            <div className="relative">
              {/* Lifecycle Steps */}
              <div className="space-y-4">
                <LifecycleStep status="complete" name="Interpret & Decompose" />
                <LifecycleStep status="complete" name="Build Requirements & Scene Graph" />
                <LifecycleStep status="active" name="Generate Candidates" detail="Provider: FLUX.1 [schnell]" />
                <LifecycleStep status="pending" name="Quality Evaluation Ensemble" />
                <LifecycleStep status="pending" name="Diagnose & Repair" />
                <LifecycleStep status="pending" name="Final QA & Approve" />
              </div>
              {/* Connecting line */}
              <div className="absolute top-2 left-[11px] bottom-6 w-px bg-slate-200 -z-10" />
            </div>
          </div>

          <div className="p-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Provider Health</h2>
            <div className="space-y-3">
              <ProviderStatus name="Primary Diffusion Cluster" latency="1.2s" status="good" />
              <ProviderStatus name="Identity LoRA Node" latency="0.8s" status="good" />
              <ProviderStatus name="Vision Evaluator" latency="2.4s" status="warning" />
            </div>
          </div>
        </div>

        {/* Right Column: Generation & Evaluation View */}
        <div className="flex-1 flex flex-col bg-slate-100/50">
          
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
            <div className="flex space-x-6">
              <button className="text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 pb-4 -mb-4">Candidates</button>
              <button className="text-sm font-medium text-slate-500 hover:text-slate-700 pb-4 -mb-4">Quality Evidence</button>
              <button className="text-sm font-medium text-slate-500 hover:text-slate-700 pb-4 -mb-4">Repair History</button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              
              {/* Skeleton Candidate Card */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse" />
                  <ImageIcon className="w-8 h-8 text-slate-300 relative z-10" />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur rounded text-xs font-semibold text-slate-700 z-10">
                    Candidate A: Literal
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-500">Generating...</span>
                      <span className="text-xs font-medium text-indigo-600">45%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center">
                    <Server className="w-3 h-3 mr-1" />
                    Provider: In-flight
                  </div>
                </div>
              </div>

              {/* Empty slot */}
              <div className="bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Candidate B Pending</span>
                <span className="text-xs mt-1">Waiting for structural composition plan...</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function LifecycleStep({ status, name, detail }: { status: 'complete' | 'active' | 'pending' | 'failed', name: string, detail?: string }) {
  return (
    <div className="flex relative">
      <div className="flex-shrink-0 mt-0.5 z-10 bg-white">
        {status === 'complete' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
        {status === 'active' && <div className="w-6 h-6 rounded-full border-2 border-indigo-600 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" /></div>}
        {status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" />}
        {status === 'failed' && <AlertCircle className="w-6 h-6 text-red-500" />}
      </div>
      <div className="ml-4 pb-2">
        <h4 className={`text-sm font-medium ${status === 'active' ? 'text-indigo-900' : status === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>
          {name}
        </h4>
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

function ProviderStatus({ name, latency, status }: { name: string, latency: string, status: 'good' | 'warning' | 'error' }) {
  return (
    <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm">
      <div className="flex items-center">
        <Server className={`w-4 h-4 mr-2 ${status === 'good' ? 'text-emerald-500' : status === 'warning' ? 'text-amber-500' : 'text-red-500'}`} />
        <span className="text-sm font-medium text-slate-700">{name}</span>
      </div>
      <div className="text-xs text-slate-500 flex items-center">
        <Clock className="w-3 h-3 mr-1" />
        {latency}
      </div>
    </div>
  );
}
