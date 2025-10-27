<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Middleware;

use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Response;
use OCP\AppFramework\Middleware;
use OCP\IConfig;
use OCP\IRequest;

class CorsMiddleware extends Middleware {
    private IRequest $request;
    private IConfig $config;

    public function __construct(IRequest $request, IConfig $config) {
        $this->request = $request;
        $this->config = $config;
    }

    /**
     * Add CORS headers after controller execution
     */
    public function afterController($controller, $methodName, Response $response): Response {
        // Get allowed origins from config
        $allowedOrigins = $this->getAllowedOrigins();
        
        $origin = $this->request->getHeader('Origin');
        
        // Check if origin is allowed
        if ($origin && in_array($origin, $allowedOrigins)) {
            $response->addHeader('Access-Control-Allow-Origin', $origin);
            $response->addHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            $response->addHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Requested-With');
            $response->addHeader('Access-Control-Allow-Credentials', 'true');
            $response->addHeader('Access-Control-Max-Age', '3600');
        }
        
        return $response;
    }

    /**
     * Handle preflight OPTIONS requests
     */
    public function beforeController($controller, $methodName) {
        if ($this->request->getMethod() === 'OPTIONS') {
            // Preflight request will be handled by afterController
        }
    }

    /**
     * Get allowed origins from app config
     */
    private function getAllowedOrigins(): array {
        $originsConfig = $this->config->getAppValue(
            'outlook_integrator',
            'allowed_origins',
            'https://fredrikjonassonitsb.github.io'
        );
        
        return array_map('trim', explode(',', $originsConfig));
    }
}

