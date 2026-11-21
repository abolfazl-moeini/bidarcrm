# WPDev Admin Panel PHP Code Recipes

Production-ready, pure PHP recipes for all 7 canonical WPDev design families.

---

## 1. List UX: Rich Cells, Badges & Card View Mode

### Rich First Column & Badges in `Base_List_Table`
```php
<?php
declare(strict_types=1);

namespace Norvan\MyPlugin\Admin\Tables;

use WPDev\Admin\Base_List_Table;

class Customer_List_Table extends Base_List_Table {

    public function get_columns(): array {
        return [
            'cb'       => '<input type="checkbox" />',
            'customer' => __( 'Customer', 'my-plugin' ),
            'status'   => __( 'Status', 'my-plugin' ),
            'plan'     => __( 'Plan', 'my-plugin' ),
            'created'  => __( 'Created', 'my-plugin' ),
        ];
    }

    /**
     * Composite primary cell: Avatar + Name + Email + Hover Row Actions
     */
    public function column_customer( array $item ): string {
        $avatar = get_avatar( $item['email'], 36, '', '', [ 'class' => 'wpdev-avatar-rounded' ] );
        $name   = esc_html( $item['name'] );
        $email  = esc_html( $item['email'] );
        $edit_url = admin_url( 'admin.php?page=my-plugin-customers&action=edit&id=' . (int) $item['id'] );

        $actions = [
            'edit'   => sprintf( '<a href="%s">%s</a>', esc_url( $edit_url ), __( 'Edit', 'my-plugin' ) ),
            'delete' => sprintf(
                '<a href="#" class="wpdev-danger-action" data-wubox="delete-customer-modal" data-id="%d">%s</a>',
                (int) $item['id'],
                __( 'Delete', 'my-plugin' )
            ),
        ];

        return sprintf(
            '<div class="wpdev-cell-composite">
                <div class="wpdev-cell-media">%s</div>
                <div class="wpdev-cell-content">
                    <strong><a href="%s" class="row-title">%s</a></strong>
                    <span class="wpdev-cell-subtext">%s</span>
                    %s
                </div>
            </div>',
            $avatar,
            esc_url( $edit_url ),
            $name,
            $email,
            $this->row_actions( $actions )
        );
    }

    /**
     * Semantic Status Pill Badge
     */
    public function column_status( array $item ): string {
        $status = $item['status'] ?? 'pending';
        $badges = [
            'active'    => [ 'label' => __( 'Active', 'my-plugin' ), 'class' => 'wpdev-badge-success' ],
            'pending'   => [ 'label' => __( 'Pending', 'my-plugin' ), 'class' => 'wpdev-badge-warning' ],
            'cancelled' => [ 'label' => __( 'Cancelled', 'my-plugin' ), 'class' => 'wpdev-badge-danger' ],
        ];

        $badge = $badges[ $status ] ?? [ 'label' => esc_html( $status ), 'class' => 'wpdev-badge-secondary' ];
        return sprintf( '<span class="wpdev-badge %s">%s</span>', esc_attr( $badge['class'] ), esc_html( $badge['label'] ) );
    }

    /**
     * Card / Grid View rendering when grid mode is active
     */
    public function single_row_grid( array $item ): void {
        $edit_url = admin_url( 'admin.php?page=my-plugin-customers&action=edit&id=' . (int) $item['id'] );
        ?>
        <div class="wpdev-grid-card">
            <div class="wpdev-grid-card-header">
                <span class="wpdev-badge wpdev-badge-primary"><?php esc_html_e( 'MAIN SITE', 'my-plugin' ); ?></span>
                <input type="checkbox" name="bulk_ids[]" value="<?php echo (int) $item['id']; ?>" />
            </div>
            <div class="wpdev-grid-card-body">
                <div class="wpdev-grid-thumbnail"><?php echo get_avatar( $item['email'], 64 ); ?></div>
                <h4 class="wpdev-grid-card-title"><?php echo esc_html( $item['name'] ); ?></h4>
                <p class="wpdev-grid-card-subtitle"><?php echo esc_html( $item['email'] ); ?></p>
            </div>
            <div class="wpdev-grid-card-footer">
                <a href="<?php echo esc_url( $edit_url ); ?>" class="button button-primary"><?php esc_html_e( 'Manage', 'my-plugin' ); ?></a>
            </div>
        </div>
        <?php
    }
}
```

---

## 2. Edit UX: Vertical Icon Tabs, "At a Glance" KPI & Sub-Tables

```php
<?php
declare(strict_types=1);

namespace Norvan\MyPlugin\Admin\Pages;

use WPDev\Admin\Edit_Admin_Page;

class Edit_Order_Page extends Edit_Admin_Page {

    public function init_widgets(): void {
        // 1. Top "At a Glance" KPI Strip
        $this->add_widget( 'at_a_glance', __( 'At a Glance', 'my-plugin' ), [
            'context'  => 'top',
            'priority' => 'high',
            'callback' => [ $this, 'render_at_a_glance' ],
        ] );

        // 2. Main Vertical Tabbed Configuration
        $this->add_tabs_widget( 'order_tabs', __( 'Order Details', 'my-plugin' ), [
            'general' => [
                'label' => __( 'General', 'my-plugin' ),
                'icon'  => 'dashicons-admin-generic',
                'view'  => [ $this, 'render_tab_general' ],
            ],
            'billing' => [
                'label' => __( 'Billing & Taxes', 'my-plugin' ),
                'icon'  => 'dashicons-money-alt',
                'view'  => [ $this, 'render_tab_billing' ],
            ],
            'notes'   => [
                'label' => __( 'Internal Notes', 'my-plugin' ),
                'icon'  => 'dashicons-format-chat',
                'view'  => [ $this, 'render_tab_notes' ],
            ],
        ] );

        // 3. Embedded Relational Sub-Table (Line Items)
        $this->add_list_table_widget( 'line_items', __( 'Order Line Items', 'my-plugin' ), [
            'table_class' => Order_Line_Items_Table::class,
            'context'     => 'normal',
        ] );
    }

    public function render_at_a_glance(): void {
        $order_id = (int) ( $_GET['id'] ?? 0 );
        $ref_id   = 'ORD-98234-X';
        $total    = '$299.00';
        $status   = 'Completed';
        ?>
        <div class="wpdev-at-a-glance-strip">
            <div class="wpdev-glance-metric">
                <span class="wpdev-glance-label"><?php esc_html_e( 'Total Amount', 'my-plugin' ); ?></span>
                <strong class="wpdev-glance-val"><?php echo esc_html( $total ); ?></strong>
            </div>
            <div class="wpdev-glance-metric">
                <span class="wpdev-glance-label"><?php esc_html_e( 'Reference ID', 'my-plugin' ); ?></span>
                <code class="wpdev-monospace-id"><?php echo esc_html( $ref_id ); ?></code>
                <button type="button" class="wpdev-copy-btn" data-clipboard-text="<?php echo esc_attr( $ref_id ); ?>" title="Copy">📋</button>
            </div>
            <div class="wpdev-glance-metric">
                <span class="wpdev-glance-label"><?php esc_html_e( 'Status', 'my-plugin' ); ?></span>
                <span class="wpdev-badge wpdev-badge-success"><?php echo esc_html( $status ); ?></span>
            </div>
        </div>
        <?php
    }
}
```

---

## 3. Sidebar UX: Modular Save, Identity & Danger Zone

```php
<?php
// Inside an Edit_Admin_Page:

// 1. Primary Save Widget (Top Sidebar)
$this->add_save_widget( 'save_order', __( 'Save', 'my-plugin' ), [
    'button_text' => __( 'Save Order', 'my-plugin' ),
    'top_fields'  => [
        [
            'id'          => 'order_slug',
            'type'        => 'text',
            'label'       => __( 'ORDER TOKEN', 'my-plugin' ),
            'readonly'    => true,
            'description' => __( 'Unique token used for webhooks and tracking.', 'my-plugin' ),
        ],
    ],
] );

// 2. User Identity Card (Mid Sidebar)
$this->add_widget( 'user_identity', __( 'Customer Profile', 'my-plugin' ), [
    'context'  => 'side',
    'callback' => function() {
        ?>
        <div class="wpdev-identity-card text-center">
            <div class="wpdev-avatar-wrap"><?php echo get_avatar( 'user@domain.test', 72 ); ?></div>
            <h3 class="wpdev-user-title">pg_demo_3</h3>
            <p class="wpdev-user-email">demo3@playground.test</p>
            <div class="wpdev-identity-actions">
                <a href="#" class="button button-secondary">→ <?php esc_html_e( 'Switch To', 'my-plugin' ); ?></a>
                <a href="#" class="button button-link">→ <?php esc_html_e( 'Visit Profile', 'my-plugin' ); ?></a>
            </div>
        </div>
        <?php
    }
] );

// 3. Danger Zone (Bottom Sidebar)
$this->add_widget( 'danger_zone', __( 'Delete / Danger Zone', 'my-plugin' ), [
    'context'  => 'side',
    'priority' => 'low',
    'callback' => function() {
        ?>
        <div class="wpdev-danger-card">
            <p class="description wpdev-danger-warning"><?php esc_html_e( 'Be careful. This action is irreversible.', 'my-plugin' ); ?></p>
            <div class="wpdev-card-footer">
                <button type="button" class="button button-danger-outline" data-wubox="confirm-delete-modal">
                    <?php esc_html_e( 'Delete Entity', 'my-plugin' ); ?>
                </button>
            </div>
        </div>
        <?php
    }
] );
```

---

## 4. Modal & Wizard UX: Step-by-Step Creation & Safe Destruction

### Step-by-Step Creation Wizard with Choice Cards
```php
<?php
// Register interactive creation modal
wpdev_register_form( 'add-broadcast-wizard', [
    'title'       => __( 'ADD BROADCAST', 'my-plugin' ),
    'access'      => 'my_plugin.broadcast.create',
    'modal_width' => 640,
    'render'      => function() {
        ?>
        <div class="wpdev-wizard" data-current-step="1">
            <!-- Step 1: Visual Card Selector -->
            <div class="wpdev-wizard-step" data-step="1">
                <label class="wpdev-field-label"><?php esc_html_e( 'BROADCAST TYPE', 'my-plugin' ); ?></label>
                <p class="description"><?php esc_html_e( 'Select the type of message you want to send.', 'my-plugin' ); ?></p>
                <div class="wpdev-card-options-grid">
                    <div class="wpdev-choice-card active" data-type="email">
                        <span class="dashicons dashicons-email-alt wpdev-choice-icon"></span>
                        <strong class="wpdev-choice-title"><?php esc_html_e( 'Email', 'my-plugin' ); ?></strong>
                        <span class="wpdev-check-badge">✔</span>
                    </div>
                    <div class="wpdev-choice-card" data-type="notice">
                        <span class="dashicons dashicons-bell wpdev-choice-icon"></span>
                        <strong class="wpdev-choice-title"><?php esc_html_e( 'Notice / Banner', 'my-plugin' ); ?></strong>
                        <span class="wpdev-check-badge">✔</span>
                    </div>
                </div>
                <div class="wpdev-modal-footer">
                    <button type="button" class="button button-primary wpdev-wizard-next">→ <?php esc_html_e( 'Next Step', 'my-plugin' ); ?></button>
                </div>
            </div>

            <!-- Step 2: Target Selection -->
            <div class="wpdev-wizard-step" data-step="2" style="display:none;">
                <button type="button" class="wpdev-back-link">← <?php esc_html_e( 'BACK TO TYPE SELECTION', 'my-plugin' ); ?></button>
                <div class="wpdev-form-group">
                    <label><?php esc_html_e( 'TARGET CUSTOMERS', 'my-plugin' ); ?></label>
                    <input type="text" class="regular-text wpdev-autocomplete" placeholder="<?php esc_attr_e( 'Search customers...', 'my-plugin' ); ?>" />
                </div>
                <div class="wpdev-modal-footer">
                    <button type="submit" class="button button-primary"><?php esc_html_e( 'Send Broadcast', 'my-plugin' ); ?></button>
                </div>
            </div>
        </div>
        <?php
    }
] );
```

### Destruction Confirmation Modal with Mandatory Toggle
```php
<?php
wpdev_register_form( 'confirm-delete-modal', [
    'title'       => __( 'CONFIRM DELETION', 'my-plugin' ),
    'access'      => 'my_plugin.entity.delete',
    'modal_width' => 450,
    'render'      => function() {
        ?>
        <div class="wpdev-safe-delete-modal">
            <div class="wpdev-toggle-row">
                <label class="wpdev-switch">
                    <input type="checkbox" id="wpdev-delete-unlock-toggle" />
                    <span class="wpdev-slider"></span>
                </label>
                <div class="wpdev-toggle-text">
                    <strong><?php esc_html_e( 'CONFIRM DELETION', 'my-plugin' ); ?></strong>
                    <p class="description"><?php esc_html_e( 'This action cannot be undone.', 'my-plugin' ); ?></p>
                </div>
            </div>
            <div class="wpdev-modal-footer">
                <!-- Button is initially disabled until toggle switch is checked -->
                <button type="submit" id="wpdev-final-delete-btn" class="button button-danger" disabled>
                    <?php esc_html_e( 'Delete Permanently', 'my-plugin' ); ?>
                </button>
            </div>
        </div>
        <script>
        document.getElementById('wpdev-delete-unlock-toggle')?.addEventListener('change', function(e) {
            const btn = document.getElementById('wpdev-final-delete-btn');
            if (btn) btn.disabled = !e.target.checked;
        });
        </script>
        <?php
    }
] );
```

---

## 5. Smart Fields UX: Conditionals, Repeaters & Page Pickers

```php
<?php
// Inside add_fields_widget():
$this->add_fields_widget( 'pricing_settings', __( 'Pricing Options', 'my-plugin' ), [
    'fields' => [
        // Instant Conditional Toggle
        [
            'id'          => 'has_setup_fee_discount',
            'type'        => 'toggle',
            'label'       => __( 'SETUP FEE DISCOUNT', 'my-plugin' ),
            'description' => __( 'Also set a discount for setup fee?', 'my-plugin' ),
        ],
        [
            'id'          => 'setup_fee_discount_amount',
            'type'        => 'number',
            'label'       => __( 'DISCOUNT VALUE', 'my-plugin' ),
            'conditions'  => [ 'has_setup_fee_discount' => true ], // Revealed only when toggle is active
        ],
        // Page Picker with Popout Jump Icon
        [
            'id'          => 'landing_page_id',
            'type'        => 'page_select',
            'label'       => __( 'LANDING PAGE', 'my-plugin' ),
            'popout'      => true, // Renders an adjacent Dashicons external link icon
            'description' => __( 'The target page where customers are redirected.', 'my-plugin' ),
        ],
        // Multi-Row Repeater
        [
            'id'          => 'custom_post_types',
            'type'        => 'repeater',
            'label'       => __( 'POST TYPES', 'my-plugin' ),
            'sub_fields'  => [
                [ 'id' => 'label', 'type' => 'text', 'placeholder' => 'e.g. Products' ],
                [ 'id' => 'slug',  'type' => 'text', 'placeholder' => 'e.g. product' ],
            ],
            'button_text' => __( '+ ADD POST TYPE', 'my-plugin' ),
        ],
        // Interactive Icon Picker (wubox + Vue + fuzzy search)
        [
            'id'          => 'menu_badge_icon',
            'type'        => 'icon-picker', // or 'icon_picker'
            'label'       => __( 'BADGE ICON', 'my-plugin' ),
            'description' => __( 'Choose from icon sets, upload an SVG, or paste raw vector geometry.', 'my-plugin' ),
        ],
    ]
] );

// Safe output rendering in frontend templates or admin chrome:
echo wpdev_render_icon( $saved_badge_icon, [
    'class'  => 'header-badge-icon',
    'width'  => 20,
    'height' => 20,
] );
```

---

## 6. Logs & Safety UX: Monospace Terminal Console

```php
<?php
// Terminal-style live console log metabox
$this->add_widget( 'test_log_console', __( 'Live Execution Log', 'my-plugin' ), [
    'context'  => 'normal',
    'callback' => function() {
        ?>
        <div class="wpdev-terminal-wrapper">
            <div class="wpdev-terminal-header">
                <span class="wpdev-terminal-title"><?php esc_html_e( 'Log Stream (UTC)', 'my-plugin' ); ?></span>
                <button type="button" class="button button-small wpdev-refresh-log-btn">⟳ <?php esc_html_e( 'Refresh Logs', 'my-plugin' ); ?></button>
            </div>
            <pre class="wpdev-terminal-screen">
[2026-09-19 14:10:02] DNS query initiated for domain.com...
[2026-09-19 14:10:03] NS: lee.ns.cloudflare.com [OK]
[2026-09-19 14:10:03] A Record: 172.64.145.59 [MATCHED]
[2026-09-19 14:10:04] SSL Handshake: Valid until 2027-01-01 [OK]
            </pre>
        </div>
        <?php
    }
] );
```

---

## 7. Dashboard & Settings UX: KPI Cards & 3-Column Settings Shell

```php
<?php
declare(strict_types=1);

namespace Norvan\MyPlugin\Admin\Pages;

use WPDev\Admin\Top_Level_Admin_Page;

class Analytics_Dashboard_Page extends Top_Level_Admin_Page {

    public function render_page(): void {
        ?>
        <div class="wpdev-dashboard-wrap">
            <div class="wpdev-dashboard-topbar">
                <h2><?php esc_html_e( 'Overview & Analytics', 'my-plugin' ); ?></h2>
                <div class="wpdev-date-filter">
                    <select name="date_range" class="wpdev-select">
                        <option value="7d"><?php esc_html_e( 'Last 7 days', 'my-plugin' ); ?></option>
                        <option value="30d"><?php esc_html_e( 'Last 30 days', 'my-plugin' ); ?></option>
                        <option value="ytd"><?php esc_html_e( 'Year to date', 'my-plugin' ); ?></option>
                    </select>
                </div>
            </div>

            <!-- KPI Metric Cards Grid -->
            <div class="wpdev-kpi-grid">
                <div class="wpdev-kpi-card">
                    <span class="wpdev-kpi-title"><?php esc_html_e( 'Total Revenue', 'my-plugin' ); ?></span>
                    <strong class="wpdev-kpi-number">$14,250.00</strong>
                    <span class="wpdev-kpi-trend positive">↑ 12.4%</span>
                </div>
                <div class="wpdev-kpi-card">
                    <span class="wpdev-kpi-title"><?php esc_html_e( 'Active Subscriptions', 'my-plugin' ); ?></span>
                    <strong class="wpdev-kpi-number">342</strong>
                    <span class="wpdev-kpi-trend positive">↑ 5 new</span>
                </div>
                <div class="wpdev-kpi-card">
                    <span class="wpdev-kpi-title"><?php esc_html_e( 'Pending Domains', 'my-plugin' ); ?></span>
                    <strong class="wpdev-kpi-number">17</strong>
                    <span class="wpdev-kpi-trend warning">Needs action</span>
                </div>
            </div>
        </div>
        <?php
    }
}
```
