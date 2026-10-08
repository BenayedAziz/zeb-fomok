export type Status = 'inbox' | 'todo' | 'doing' | 'waiting' | 'someday' | 'done';
export type Priority = 'high' | 'med' | 'low';
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
export type Horizon = 'vision' | 'year' | 'behavior';
export type ProjectStatus = 'active' | 'paused' | 'done';
/** Une tâche se coche ; un événement (réunion, anniversaire…) a lieu à un moment donné. */
export type Kind = 'task' | 'event';

export interface Item {
  id: string;
  title: string;
  raw?: string | null;
  kind?: Kind | null;
  status: Status;
  projectId?: string | null;
  domainId?: string | null;
  context?: string | null;
  priority?: Priority | null;
  date?: string | null;
  time?: string | null;
  /** Durée en minutes. */
  duration?: number | null;
  recurrence?: Recurrence | null;
  /** Jours de la semaine pour une récurrence hebdo (0 = dimanche … 6 = samedi). */
  recurrenceDays?: number[] | null;
  /** Toutes les N semaines / mois / ans. */
  recurrenceInterval?: number | null;
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
  /** Couleur propre au projet (sinon celle du domaine). */
  color?: string | null;
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

/** Article, outil ou ressource épinglé, rattaché ou non à un projet. */
export interface Pin {
  id: string;
  url: string;
  title: string;
  note?: string | null;
  projectId?: string | null;
  aiSorted?: boolean;
  createdAt: string;
}

export interface Review {
  last?: string | null;
  checks: Record<string, boolean>;
}

export interface Settings {
  /** Fonctionnalités visibles : on adapte l'appli à la personne. */
  showContexts: boolean;
  showPriorities: boolean;
  showWaitingSomeday: boolean;
  contexts: string[];
  dayStart: number;
  dayEnd: number;
  defaultCal: 'day' | 'week' | 'month';
  /** Fréquence de la revue, en jours (1, 3, 7, 14, 30). */
  reviewEvery: number;
}

export interface Data {
  items: Record<string, Item>;
  projects: Record<string, Project>;
  domains: Record<string, Domain>;
  goals: Record<string, Goal>;
  pins: Record<string, Pin>;
  review: Review;
  settings: Settings;
}

/** Un élément tel que l'IA le renvoie. */
export interface AiItem {
  kind?: string;
  status?: string;
  title?: string;
  projectId?: string | null;
  domainId?: string | null;
  context?: string | null;
  priority?: string | null;
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  recurrence?: string | null;
  recurrenceDays?: number[] | null;
  recurrenceInterval?: number | null;
  waitingFor?: string | null;
  url?: string | null;
  note?: string | null;
  newProject?: { name?: string; domainId?: string | null; outcome?: string } | null;
  reason?: string;
}
