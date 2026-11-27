/**
 * BidarCRM - KanbanBoard Component
 *
 * Horizontal responsive scrollable board container housing stage columns and
 * orchestrating deal drag-and-drop operations across the pipeline.
 */

import React from 'react';
import { PipelineStage, Opportunity } from '../../../types/espocrm';
import { KanbanColumn } from './KanbanColumn';

export interface KanbanBoardProps {
  stages: PipelineStage[];
  deals: Opportunity[];
  onMoveDeal: (dealId: string, targetStageId: string, targetStageName: string) => void;
  onSelectDeal?: (dealId: string) => void;
  onQuickAddDeal?: (stageId: string, stageName: string) => void;
  className?: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  stages,
  deals,
  onMoveDeal,
  onSelectDeal,
  onQuickAddDeal,
  className = '',
}) => {
  return (
    <div
      className={`bidar-kanban-board flex gap-4 sm:gap-5 overflow-x-auto pb-6 items-start select-none ${className}`}
      dir="rtl"
    >
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          deals={deals}
          onDropDeal={onMoveDeal}
          onSelectDeal={onSelectDeal}
          onQuickAddDeal={onQuickAddDeal}
        />
      ))}
    </div>
  );
};

export default KanbanBoard;
