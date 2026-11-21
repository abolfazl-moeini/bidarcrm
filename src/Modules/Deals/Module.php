<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Deals;

use DidarCRM\Modules\Deals\Rest\DealMoveController;
use DidarCRM\Modules\Deals\Rest\DealsController;
use DidarCRM\Modules\Deals\Rest\PipelinesController;
use DidarCRM\Modules\Deals\Services\DealService;
use DidarCRM\Modules\Deals\Services\PipelineService;
use WPDev\Core\AbstractModule;
use WPDev\Support\Rest\RestSetup;

final class Module extends AbstractModule
{
    public function get_slug(): string
    {
        return 'deals';
    }

    public function boot(): void
    {
        // Register REST controllers
        RestSetup::register(PipelinesController::class);
        RestSetup::register(DealsController::class);
        RestSetup::register(DealMoveController::class);

        if (!function_exists('is_admin') || !is_admin()) {
            return;
        }

        add_action('admin_menu', [$this, 'register_admin_menus']);
    }

    public function register_admin_menus(): void
    {
        add_menu_page(
            __('دیدار CRM', 'didar-crm'),
            __('دیدار CRM', 'didar-crm'),
            'edit_posts',
            'wpdev-didar-crm',
            [$this, 'render_kanban_page'],
            'dashicons-chart-pie',
            30
        );

        add_submenu_page(
            'wpdev-didar-crm',
            __('خط فروش (کانبان)', 'didar-crm'),
            __('خط فروش (کانبان)', 'didar-crm'),
            'edit_posts',
            'wpdev-didar-crm-deals',
            [$this, 'render_kanban_page']
        );

        // Alias for didar-deals
        add_submenu_page(
            'wpdev-didar-crm',
            __('معاملات', 'didar-crm'),
            __('معاملات', 'didar-crm'),
            'edit_posts',
            'didar-deals',
            [$this, 'render_kanban_page']
        );
    }

    public function render_kanban_page(): void
    {
        $pipelineService = new PipelineService();
        $dealService = new DealService();

        $pipelines = $pipelineService->get_pipelines();
        $currentPipeline = !empty($pipelines) ? $pipelines[0] : null;

        $stages = $currentPipeline['stages'] ?? [];
        $deals = $dealService->get_deals([
            'pipeline_id' => $currentPipeline['id'] ?? 1,
        ]);

        // Group deals by stage
        $dealsByStage = [];
        foreach ($stages as $s) {
            $dealsByStage[$s['id']] = [];
        }
        foreach ($deals as $d) {
            $stage_id = $d['stage_id'] ?? '';
            if (!isset($dealsByStage[$stage_id])) {
                $dealsByStage[$stage_id] = [];
            }
            $dealsByStage[$stage_id][] = $d;
        }

        ?>
        <div class="wrap didar-crm-deals-wrap" style="direction: rtl; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
                    <?php esc_html_e('Deals Pipeline - کانبان خط فروش', 'didar-crm'); ?>
                </h1>
                <div>
                    <span style="background: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 13px;">
                        <?php echo esc_html($currentPipeline['title'] ?? 'Pipeline'); ?>
                    </span>
                </div>
            </div>

            <!-- Kanban Board Container -->
            <div class="didar-kanban-board" style="display: flex; gap: 16px; overflow-x: auto; padding-bottom: 20px; min-height: 550px;">
                <?php foreach ($stages as $stage): 
                    $stage_id = esc_attr($stage['id']);
                    $stage_name = esc_attr($stage['name']);
                    $stageDeals = $dealsByStage[$stage['id']] ?? [];
                    $stageTotal = 0;
                    foreach ($stageDeals as $sd) {
                        $stageTotal += (int) ($sd['amount'] ?? 0);
                    }
                ?>
                    <div 
                        class="didar-kanban-column" 
                        role="region" 
                        aria-label="<?php echo $stage_name; ?>" 
                        data-stage-id="<?php echo $stage_id; ?>"
                        style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; width: 310px; min-width: 300px; display: flex; flex-direction: column;"
                        ondragover="event.preventDefault(); this.style.background='#e0f2fe';"
                        ondragleave="this.style.background='#f8fafc';"
                        ondrop="didarDropDeal(event, '<?php echo $stage_id; ?>')"
                    >
                        <!-- Column Header -->
                        <div style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1; background: #fff; border-radius: 8px 8px 0 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">
                                    <?php echo esc_html($stage['name']); ?>
                                </h3>
                                <span style="background: #e2e8f0; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 12px;">
                                    <?php echo count($stageDeals); ?>
                                </span>
                            </div>
                            <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                                <?php echo number_format($stageTotal); ?> تومان
                                <?php if (!empty($stage['rotten_days'])): ?>
                                    <span style="font-size: 11px; color: #94a3b8; margin-right: 6px;">
                                        (مهلت: <?php echo esc_html($stage['rotten_days']); ?> روز)
                                    </span>
                                <?php endif; ?>
                            </div>
                        </div>

                        <!-- Deal Cards List -->
                        <div class="didar-cards-container" style="padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 10px;">
                            <?php foreach ($stageDeals as $deal): 
                                $deal_id = (int) $deal['id'];
                                $is_rotten = !empty($deal['is_rotten']);
                            ?>
                                <div 
                                    id="deal-card-<?php echo $deal_id; ?>" 
                                    class="didar-deal-card <?php echo $is_rotten ? 'rotten-alert' : ''; ?>"
                                    draggable="true" 
                                    ondragstart="event.dataTransfer.setData('text/plain', '<?php echo $deal_id; ?>')"
                                    style="background: #fff; border: 1px solid <?php echo $is_rotten ? '#ef4444' : '#e2e8f0'; ?>; border-radius: 6px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: grab; transition: all 0.2s;"
                                >
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                        <div style="font-weight: 600; font-size: 14px; color: #0f172a;">
                                            <?php echo esc_html($deal['title']); ?>
                                        </div>
                                        <?php if ($is_rotten): ?>
                                            <span 
                                                role="status" 
                                                aria-label="rotten" 
                                                class="rotten-badge" 
                                                style="background: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;"
                                            >
                                                Rotten (راکد)
                                            </span>
                                        <?php endif; ?>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #334155; margin-top: 8px;">
                                        <span style="font-weight: 700; color: #059669;">
                                            <?php echo number_format((int) ($deal['amount'] ?? 0)); ?> تومان
                                        </span>
                                        <span style="font-size: 11px; color: #64748b;">
                                            احتمال: <?php echo esc_html($deal['win_probability'] ?? 0); ?>%
                                        </span>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <script>
        function didarDropDeal(e, targetStageId) {
            e.preventDefault();
            e.currentTarget.style.background = '#f8fafc';
            var dealId = e.dataTransfer.getData('text/plain');
            if (!dealId) return;

            var card = document.getElementById('deal-card-' + dealId);
            if (card) {
                var targetContainer = e.currentTarget.querySelector('.didar-cards-container');
                if (targetContainer) {
                    targetContainer.appendChild(card);
                }
            }

            // Sync with backend REST
            var restUrl = '/wp-json/wpdev-didar-crm/v1/deals/' + dealId + '/move';
            fetch(restUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': (window.wpApiSettings && window.wpApiSettings.nonce) ? window.wpApiSettings.nonce : ''
                },
                body: JSON.stringify({ stage_id: targetStageId })
            }).catch(function(err) {
                console.error('Failed to move deal', err);
            });
        }
        </script>
        <?php
    }
}
