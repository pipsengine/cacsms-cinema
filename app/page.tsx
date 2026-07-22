import React from 'react';
import Link from 'next/link';
import { ArrowRight, ImageIcon, Film, Video, FileText } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          cacsms-cinema overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { name: 'Active Projects', value: '3', trend: '+1 this week' },
          { name: 'Pending Generations', value: '42', trend: 'Queue healthy' },
          { name: 'Approved Assets', value: '1,204', trend: '+15 today' },
          { name: 'System Health', value: 'Operational', trend: 'All services up', status: 'good' },
        ].map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow-sm rounded-lg border border-slate-200">
            <div className="p-5">
              <dt className="text-sm font-medium text-slate-500 truncate">{stat.name}</dt>
              <dd className="mt-1 text-3xl font-semibold text-slate-900">
                {stat.status === 'good' ? (
                  <span className="text-emerald-600">{stat.value}</span>
                ) : (
                  stat.value
                )}
              </dd>
            </div>
            <div className="bg-slate-50 px-5 py-3">
              <div className="text-sm text-slate-500">{stat.trend}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard 
            title="Image Generator" 
            description="Autonomous visual production workspace"
            href="/visuals/image-generator"
            icon={ImageIcon}
          />
          <ActionCard 
            title="Script Writer" 
            description="Professional scene structuring"
            href="/scripts"
            icon={FileText}
          />
          <ActionCard 
            title="Storyboard Editor" 
            description="Sequence and shot planning"
            href="/storyboards"
            icon={Film}
          />
          <ActionCard 
            title="Video Assembly" 
            description="Image-to-video processing"
            href="/video"
            icon={Video}
          />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, description, href, icon: Icon }: any) {
  return (
    <Link href={href} className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors">
      <div>
        <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 ring-4 ring-white">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-medium">
          <span className="absolute inset-0" aria-hidden="true" />
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {description}
        </p>
      </div>
      <span className="pointer-events-none absolute top-6 right-6 text-slate-300 group-hover:text-slate-400" aria-hidden="true">
        <ArrowRight className="h-6 w-6" />
      </span>
    </Link>
  );
}
