<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCA\OutlookIntegrator\Middleware\CorsMiddleware;

class Application extends App implements IBootstrap {
    public const APP_ID = 'outlook_integrator';

    public function __construct(array $urlParams = []) {
        parent::__construct(self::APP_ID, $urlParams);
    }

    public function register(IRegistrationContext $context): void {
        // Register middleware
        $context->registerMiddleware(CorsMiddleware::class);
    }

    public function boot(IBootContext $context): void {
        // Boot logic if needed
    }
}

