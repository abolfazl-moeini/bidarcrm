<?php
/**
 * BidarCRM - Clean Admin Entry Point Redirector
 *
 * Forwards requests directed to admin entry to EspoCRM native interface.
 */
declare(strict_types=1);

header('Location: /admin', true, 302);
exit;
