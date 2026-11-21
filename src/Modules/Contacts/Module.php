<?php
declare(strict_types=1);

namespace DidarCRM\Modules\Contacts;

use DidarCRM\Modules\Contacts\Rest\CompaniesController;
use DidarCRM\Modules\Contacts\Rest\ContactLinkController;
use DidarCRM\Modules\Contacts\Rest\ContactsController;
use DidarCRM\Modules\Contacts\Services\CompanyService;
use DidarCRM\Modules\Contacts\Services\ContactService;
use DidarCRM\Modules\Contacts\Services\TimelineService;
use WPDev\Core\AbstractModule;
use WPDev\Support\Rest\RestSetup;

final class Module extends AbstractModule
{
    public function get_slug(): string
    {
        return 'contacts';
    }

    public function boot(): void
    {
        RestSetup::register(CompaniesController::class);
        RestSetup::register(ContactsController::class);
        RestSetup::register(ContactLinkController::class);

        if (!function_exists('is_admin') || !is_admin()) {
            return;
        }

        add_action('admin_menu', [$this, 'register_admin_menus']);
    }

    public function register_admin_menus(): void
    {
        add_submenu_page(
            'wpdev-didar-crm',
            __('مخاطبان و اشخاص', 'didar-crm'),
            __('مخاطبان و اشخاص', 'didar-crm'),
            'edit_posts',
            'didar-contacts',
            [$this, 'render_contacts_page']
        );
    }

    public function render_contacts_page(): void
    {
        $contactId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        $contactService = new ContactService();
        $companyService = new CompanyService();
        $timelineService = new TimelineService();

        if ($contactId > 0) {
            $contact = $contactService->get_contact($contactId);
            $company = $contact && !empty($contact['company_id']) ? $companyService->get_company((int) $contact['company_id']) : null;
            $events = $timelineService->get_timeline('contact', $contactId);
            $this->render_contact_detail($contact, $company, $events);
        } else {
            $contacts = $contactService->get_contacts();
            $this->render_contacts_list($contacts);
        }
    }

    /**
     * @param array<string, mixed>|null $contact
     * @param array<string, mixed>|null $company
     * @param array<int, array<string, mixed>> $events
     */
    private function render_contact_detail(?array $contact, ?array $company, array $events): void
    {
        if (!$contact) {
            echo '<div class="wrap"><div class="notice notice-error"><p>' . esc_html__('مخاطب یافت نشد.', 'didar-crm') . '</p></div></div>';
            return;
        }

        $fullName = trim(($contact['first_name'] ?? '') . ' ' . ($contact['last_name'] ?? ''));
        ?>
        <div class="wrap didar-contact-profile" style="direction: rtl; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
                    <?php echo esc_html(sprintf(__('پروفایل مخاطب: %s', 'didar-crm'), $fullName)); ?>
                </h1>
                <a href="<?php echo esc_url(admin_url('admin.php?page=didar-contacts')); ?>" class="button">
                    <?php esc_html_e('بازگشت به فهرست مخاطبان', 'didar-crm'); ?>
                </a>
            </div>

            <div style="display: grid; grid-template-columns: 340px 1fr; gap: 24px;">
                <!-- Sidebar Info Card -->
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 16px; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <?php esc_html_e('اطلاعات شخصی و سازمانی', 'didar-crm'); ?>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
                        <div>
                            <span style="color: #64748b;"><?php esc_html_e('نام و نام خانوادگی:', 'didar-crm'); ?></span>
                            <strong style="margin-right: 6px;"><?php echo esc_html($fullName); ?></strong>
                        </div>
                        <div>
                            <span style="color: #64748b;"><?php esc_html_e('ایمیل:', 'didar-crm'); ?></span>
                            <span style="margin-right: 6px;"><?php echo esc_html($contact['email'] ?? '-'); ?></span>
                        </div>
                        <div>
                            <span style="color: #64748b;"><?php esc_html_e('شماره تماس:', 'didar-crm'); ?></span>
                            <span style="margin-right: 6px;"><?php echo esc_html($contact['phone'] ?? '-'); ?></span>
                        </div>
                        <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 6px;">
                            <span style="color: #64748b; display: block; margin-bottom: 4px;"><?php esc_html_e('سازمان مربوطه:', 'didar-crm'); ?></span>
                            <?php if ($company): ?>
                                <span style="background: #e0f2fe; color: #0369a1; font-weight: 600; padding: 4px 10px; border-radius: 6px; display: inline-block;">
                                    <?php echo esc_html($company['name']); ?>
                                </span>
                            <?php else: ?>
                                <span style="color: #94a3b8;"><?php esc_html_e('هنوز به سازمانی متصل نشده است.', 'didar-crm'); ?></span>
                            <?php endif; ?>
                        </div>

                        <?php if (!empty($contact['custom_fields'])): ?>
                            <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 6px;">
                                <span style="color: #64748b; display: block; margin-bottom: 6px;"><?php esc_html_e('فیلدهای سفارشی:', 'didar-crm'); ?></span>
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    <?php foreach ($contact['custom_fields'] as $k => $v): ?>
                                        <div style="font-size: 13px;">
                                            <span style="color: #64748b;"><?php echo esc_html($k); ?>:</span>
                                            <strong style="margin-right: 4px;"><?php echo esc_html(is_scalar($v) ? (string) $v : json_encode($v)); ?></strong>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Unified Activity Timeline -->
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size: 16px; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <?php esc_html_e('خط زمانی یکپارچه فعالیت‌ها (Activity Timeline)', 'didar-crm'); ?>
                    </div>

                    <div id="activity-timeline" style="display: flex; flex-direction: column; gap: 14px;">
                        <?php if (empty($events)): ?>
                            <div style="color: #94a3b8; font-size: 14px; text-align: center; padding: 30px;">
                                <?php esc_html_e('هیچ رویدادی تاکنون ثبت نشده است.', 'didar-crm'); ?>
                            </div>
                        <?php else: ?>
                            <?php foreach ($events as $event): ?>
                                <div style="background: #f8fafc; border-right: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="font-size: 14px; font-weight: 600; color: #1e293b;">
                                            <?php echo esc_html($event['description'] ?? ''); ?>
                                        </span>
                                        <span style="font-size: 11px; color: #94a3b8;">
                                            <?php echo esc_html($event['created_at'] ?? ''); ?>
                                        </span>
                                    </div>
                                    <?php if (!empty($event['meta']['custom_fields'])): ?>
                                        <div style="font-size: 12px; color: #475569; margin-top: 6px;">
                                            <?php echo esc_html(json_encode($event['meta']['custom_fields'], JSON_UNESCAPED_UNICODE)); ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * @param array<int, array<string, mixed>> $contacts
     */
    private function render_contacts_list(array $contacts): void
    {
        ?>
        <div class="wrap" style="direction: rtl; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
                <?php esc_html_e('مخاطبان و اشخاص دیدار CRM', 'didar-crm'); ?>
            </h1>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php esc_html_e('نام و نام خانوادگی', 'didar-crm'); ?></th>
                        <th><?php esc_html_e('ایمیل', 'didar-crm'); ?></th>
                        <th><?php esc_html_e('تلفن', 'didar-crm'); ?></th>
                        <th><?php esc_html_e('عملیات', 'didar-crm'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($contacts)): ?>
                        <tr><td colspan="4" style="text-align: center; padding: 20px;"><?php esc_html_e('مخاطبی یافت نشد.', 'didar-crm'); ?></td></tr>
                    <?php else: ?>
                        <?php foreach ($contacts as $c): ?>
                            <tr>
                                <td><strong><?php echo esc_html(($c['first_name'] ?? '') . ' ' . ($c['last_name'] ?? '')); ?></strong></td>
                                <td><?php echo esc_html($c['email'] ?? '-'); ?></td>
                                <td><?php echo esc_html($c['phone'] ?? '-'); ?></td>
                                <td>
                                    <a href="<?php echo esc_url(admin_url('admin.php?page=didar-contacts&id=' . (int) $c['id'])); ?>" class="button button-small">
                                        <?php esc_html_e('مشاهده پروفایل و تایم‌لاین', 'didar-crm'); ?>
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
}
