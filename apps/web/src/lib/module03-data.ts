import type {ProjectStatus} from './module02-data';

export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ContentProject = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: ProjectStatus;
  mode: string;
  progress: number;
  completed: number;
  total: number;
  stage: string;
  owner: string;
  platform: string;
  type: string;
  category: string;
  objective: string;
  audience: string;
  countries: string[];
  language: string;
  duration: string;
  aspectRatio: string;
  priority: ProjectPriority;
  deadline: string;
  budget: number;
  updated: string;
  creativeDirection: string;
};

/** Map API list/detail rows into the ContentProject view model. */
export function mapProjectRow(p: any): ContentProject {
  let countries: string[] = [];
  try { countries = JSON.parse(p.TargetCountriesJson || '[]'); } catch { countries = []; }
  return {
    id: p.ContentProjectId,
    code: p.ContentCode,
    title: p.WorkingTitle,
    description: p.Description || '',
    status: p.Status,
    mode: p.AutonomyMode || 'AI_ASSISTED',
    progress: Number(p.ProgressPercent || 0),
    completed: Number(p.CompletedStages || 0),
    total: Number(p.TotalStages || 22),
    stage: p.CurrentStageName || 'Not started',
    owner: p.OwnerName || 'Unassigned',
    platform: p.PrimaryPlatform || '—',
    type: p.ContentType || '—',
    category: p.Category || '—',
    objective: p.Objective || '—',
    audience: p.TargetAudience || '—',
    countries,
    language: p.Language || '—',
    duration: p.PlannedDurationSeconds ? `${Math.ceil(p.PlannedDurationSeconds / 60)} min` : '—',
    aspectRatio: p.AspectRatio || '—',
    priority: (p.Priority || 'MEDIUM') as ProjectPriority,
    deadline: p.DeadlineAt ? new Date(p.DeadlineAt).toLocaleDateString() : '—',
    budget: Number(p.BudgetLimit || 0),
    updated: p.UpdatedAt ? new Date(p.UpdatedAt).toLocaleString() : '—',
    creativeDirection: p.CreativeDirection || '—'
  };
}
