export type Status = 'inbox' | 'todo' | 'doing' | 'waiting' | 'someday' | 'done';
export type Priority = 'high' | 'med' | 'low';
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type Horizon = 'vision' | 'year' | 'behavior';
export type ProjectStatus = 'active' | 'paused' | 'done';

export interface Item {
  id: string;
  title: string;
  raw?: string | null;
  status: Status;
  projectId?: string | null;
  domainId?: string | null;
  context?: string | null;
  priority?: Priority | null;
  date?: string | null;
  time?: string | null;
  recurrence?: Recurrence | null;
  waitingFor?: string | null;
  waitingSince?: string | null;
  notes?: string | null;
  aiSorted?: boolean;
  aiReason?: string | null;
  doneAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectLink {
  url: string;
  label: string;
}

export interface Project {
  id: string;
  name: string;
  domainId?: string | null;
  goalId?: string | null;
  status: ProjectStatus;
  outcome?: string | null;
  description?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  links: ProjectLink[];
  aiSorted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Domain {
  id: string;
  name: string;
  color: string;
  position: number;
  createdAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  horizon: Horizon;
  notes?: string | null;
  createdAt: string;
}

export interface Review {
  last?: string | null;
  checks: Record<string, boolean>;
}

export interface Data {
  items: Record<string, Item>;
  projects: Record<string, Project>;
  domains: Record<string, Domain>;
  goals: Record<string, Goal>;
  review: Review;
}

/** Ce que l'IA renvoie pour un élément capturé. */
export interface AiResult {
  status?: string;
  title?: string;
  projectId?: string | null;
  domainId?: string | null;
  context?: string | null;
  priority?: string | null;
  date?: string | null;
  time?: string | null;
  recurrence?: string | null;
  waitingFor?: string | null;
  newProject?: { name?: string; domainId?: string | null; outcome?: string } | null;
  reason?: string;
}
