<?php

use Espo\Core\Container;
use Espo\Core\InjectableFactory;
use Espo\Core\Utils\Config;
use Espo\Core\Utils\Config\ConfigWriter;

class AfterInstall
{
    private const THEME = 'Bidar';
    private const LAYOUT = 'bidarLayout';

    public function run(Container $container): void
    {
        $config = $container->getByClass(Config::class);
        $configWriter = $container->getByClass(InjectableFactory::class)->create(ConfigWriter::class);

        $changed = false;
        $systemTheme = $config->get('theme');
        if (empty($systemTheme) || $systemTheme === 'Espo' || $systemTheme === 'Lucid') {
            $configWriter->set('theme', self::THEME);
            $changed = true;
        }

        if (!$config->get(self::LAYOUT)) {
            $configWriter->set(self::LAYOUT, 'split');
            $changed = true;
        }

        if ($changed) {
            $configWriter->save();
        }
    }
}
