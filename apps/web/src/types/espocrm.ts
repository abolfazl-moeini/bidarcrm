/**
 * BidarCRM - EspoCRM 10.1.4 TypeScript Domain Types
 * Matching EspoCRM Core Schema, Custom Modules (BidarSales, BidarIran), and REST APIs
 */

export interface EspoListResponse<T> {
  list: T[];
  total: number;
}

export interface EspoUser {
  id: string;
  userName: string;
  name: string;
  isAdmin?: boolean;
  roles?: string[];
  avatarId?: string;
  title?: string;
  emailAddress?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  probability?: number;
  rottenDays?: number | null;
  color?: string;
  pipelineId?: string;
  pipelineName?: string;
  order?: number;
  isWon?: boolean;
  isLost?: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault?: boolean;
  stages?: PipelineStage[];
  stagesIds?: string[];
  stagesNames?: Record<string, string>;
  order?: number;
  createdAt?: string;
}

export interface Opportunity {
  id: string;
  name: string;
  amount?: number;
  stage?: string;
  probability?: number;
  closeDate?: string;
  pipelineId?: string;
  pipelineName?: string;
  pipelineStageId?: string;
  pipelineStageName?: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  lastActivityAt?: string;
  isRotten?: boolean;
  daysSinceLastActivity?: number;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  title?: string;
  accountId?: string;
  accountName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  emailAddress?: string;
  phoneNumber?: string;
  website?: string;
  type?: string;
  industry?: string;
  billingAddressStreet?: string;
  billingAddressCity?: string;
  billingAddressState?: string;
  billingAddressPostalCode?: string;
  billingAddressCountry?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface Note {
  id: string;
  parentType?: string;
  parentId?: string;
  type?: string;
  post?: string;
  data?: Record<string, unknown>;
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
  attachmentsIds?: string[];
  attachmentsNames?: Record<string, string>;
}

export type ActivityStatus = 'Planned' | 'Held' | 'Not Held';

export interface Call {
  id: string;
  name: string;
  status: ActivityStatus;
  dateStart?: string;
  dateEnd?: string;
  duration?: number;
  direction?: 'Inbound' | 'Outbound';
  parentType?: string;
  parentId?: string;
  parentName?: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  description?: string;
  createdAt?: string;
}

export interface Meeting {
  id: string;
  name: string;
  status: ActivityStatus;
  dateStart?: string;
  dateEnd?: string;
  parentType?: string;
  parentId?: string;
  parentName?: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  description?: string;
  createdAt?: string;
}

export type TaskStatus = 'Not Started' | 'Started' | 'Completed' | 'Canceled' | 'Deferred';
export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  priority?: TaskPriority;
  dateDue?: string;
  dateStartDate?: string;
  parentType?: string;
  parentId?: string;
  parentName?: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  description?: string;
  createdAt?: string;
}

export interface KanbanResponse {
  list: Opportunity[];
  total: number;
  stageList?: PipelineStage[];
}

export interface DashboardSummary {
  openCount: number;
  openAmount: number;
  wonCount: number;
  wonAmount: number;
  rottenCount: number;
  overdueActivitiesCount: number;
  funnelStages: Array<{
    stageId: string;
    stageName: string;
    count: number;
    amount: number;
    color?: string;
  }>;
}

export interface GlobalSearchResult {
  entityType: string;
  id: string;
  name: string;
  description?: string;
  extra?: Record<string, unknown>;
}
