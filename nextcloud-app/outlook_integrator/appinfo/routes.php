<?php
/**
 * API Routes för Outlook Integrator
 */

return [
    'routes' => [
        // API v1 routes
        ['name' => 'api#createMeeting', 'url' => '/api/v1/meeting', 'verb' => 'POST'],
        ['name' => 'api#getStatus', 'url' => '/api/v1/status', 'verb' => 'GET'],
        ['name' => 'api#verifyAuth', 'url' => '/api/v1/auth/verify', 'verb' => 'POST'],
        
        // CORS preflight
        ['name' => 'api#preflightCors', 'url' => '/api/v1/{path}', 'verb' => 'OPTIONS', 'requirements' => ['path' => '.+']],
    ]
];

