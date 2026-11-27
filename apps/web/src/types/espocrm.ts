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
  mappedStatus?: string;
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
  lossReason?: string;
  lossReasonNote?: string;
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
  nationalCode?: string;
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
  nationalId?: string;
  shebaNumber?: string;
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
  relatedType?: string;
  relatedName?: string;
  relatedId?: string;
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
  dateDue?: string;
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
  dateDue?: string;
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
  type?: 'Task' | 'Call' | 'Meeting';
  priority?: TaskPriority;
  dateEnd?: string;
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
  conversionRate?: number;
  avgSalesCycleDays?: number;
  lossReasonsBreakdown?: Array<{
    reason: string;
    label: string;
    count: number;
    amount: number;
  }>;
  topSalesReps?: Array<{
    userId: string;
    userName: string;
    wonAmount: number;
    wonCount: number;
    openCount: number;
    rottenCount: number;
  }>;
  goal?: {
    name?: string;
    targetValue?: number;
    currentValue?: number;
    percentage?: number;
    remainingValue?: number;
  };
  leadSourceBreakdown?: Array<{
    source: string;
    label: string;
    count: number;
    amount: number;
    percentage?: number;
  }>;
  funnelStages: Array<{
    stageId: string;
    stageName: string;
    count: number;
    amount: number;
    color?: string;
  }>;
}

export interface GlobalSearchResult {
  entityType?: string;
  _scope?: string;
  id: string;
  name: string;
  description?: string;
  extra?: Record<string, unknown>;
}

export interface Lead {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  accountName?: string;
  title?: string;
  status?: 'New' | 'Assigned' | 'In Process' | 'Converted' | 'Recycled' | 'Dead' | string;
  source?: string;
  description?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface BidarProduct {
  id: string;
  name: string;
  sku?: string;
  code?: string;
  unitPrice?: number;
  category?: string;
  unit?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface BidarDealItem {
  id: string;
  name?: string;
  opportunityId?: string;
  opportunityName?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
  lineTotal?: number;
  createdAt?: string;
}

export interface BidarGoal {
  id: string;
  name: string;
  metricType?: 'wonAmount' | 'wonCount' | 'dealsCreated' | 'activitiesHeld';
  scopeType?: 'all' | 'team' | 'user';
  assignedUserId?: string;
  assignedUserName?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  dateStart?: string;
  dateEnd?: string;
  targetValue: number;
  currentValue?: number;
  progressPercent?: number;
  createdAt?: string;
}

export interface BidarSmsTemplate {
  id: string;
  name: string;
  body: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface BidarApiKey {
  id: string;
  name: string;
  keyPrefix?: string;
  rawKey?: string;
  isActive?: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  allowedIpList?: string[];
  userId?: string;
  userName?: string;
  createdAt?: string;
}

export interface EspoNotification {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
  userId?: string;
  createdAt?: string;
  isRead?: boolean;
  message?: string;
  relatedId?: string;
  relatedType?: string;
}

