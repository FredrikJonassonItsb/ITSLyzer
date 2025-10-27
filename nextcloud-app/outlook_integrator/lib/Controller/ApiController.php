<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;
use OCA\OutlookIntegrator\Service\MeetingService;
use Psr\Log\LoggerInterface;

class ApiController extends Controller {
    private IUserSession $userSession;
    private MeetingService $meetingService;
    private LoggerInterface $logger;

    public function __construct(
        string $appName,
        IRequest $request,
        IUserSession $userSession,
        MeetingService $meetingService,
        LoggerInterface $logger
    ) {
        parent::__construct($appName, $request);
        $this->userSession = $userSession;
        $this->meetingService = $meetingService;
        $this->logger = $logger;
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * @PublicPage
     * 
     * Handle CORS preflight requests
     */
    public function preflightCors(string $path): JSONResponse {
        return new JSONResponse([], Http::STATUS_OK);
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * 
     * Create a Nextcloud Talk meeting with calendar integration
     * 
     * @param string $title Meeting title
     * @param string $start Start time (ISO 8601)
     * @param string $end End time (ISO 8601)
     * @param array $participants List of participants with settings
     * @return JSONResponse
     */
    public function createMeeting(
        string $title,
        string $start,
        string $end,
        array $participants = []
    ): JSONResponse {
        try {
            // Get current user
            $user = $this->userSession->getUser();
            if (!$user) {
                return new JSONResponse(
                    ['error' => 'User not authenticated'],
                    Http::STATUS_UNAUTHORIZED
                );
            }

            $userId = $user->getUID();

            // Validate input
            if (empty($title)) {
                return new JSONResponse(
                    ['error' => 'Meeting title is required'],
                    Http::STATUS_BAD_REQUEST
                );
            }

            // Parse dates
            try {
                $startDate = new \DateTime($start);
                $endDate = new \DateTime($end);
            } catch (\Exception $e) {
                return new JSONResponse(
                    ['error' => 'Invalid date format'],
                    Http::STATUS_BAD_REQUEST
                );
            }

            // Create meeting
            $meetingData = [
                'title' => $title,
                'start' => $startDate,
                'end' => $endDate,
                'participants' => $participants
            ];

            $result = $this->meetingService->createMeeting($userId, $meetingData);

            return new JSONResponse([
                'success' => true,
                'meeting' => $result
            ], Http::STATUS_OK);

        } catch (\Exception $e) {
            $this->logger->error('Failed to create meeting: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);

            return new JSONResponse(
                ['error' => 'Failed to create meeting: ' . $e->getMessage()],
                Http::STATUS_INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * 
     * Get status and user information
     * 
     * @return JSONResponse
     */
    public function getStatus(): JSONResponse {
        try {
            $user = $this->userSession->getUser();
            if (!$user) {
                return new JSONResponse(
                    ['error' => 'User not authenticated'],
                    Http::STATUS_UNAUTHORIZED
                );
            }

            // Check if Talk and Calendar apps are enabled
            $talkEnabled = \OC::$server->getAppManager()->isEnabledForUser('spreed');
            $calendarEnabled = \OC::$server->getAppManager()->isEnabledForUser('calendar');

            return new JSONResponse([
                'status' => 'ok',
                'version' => '1.0.0',
                'nextcloud_version' => \OC::$server->getSystemConfig()->getValue('version'),
                'talk_enabled' => $talkEnabled,
                'calendar_enabled' => $calendarEnabled,
                'user' => [
                    'uid' => $user->getUID(),
                    'displayName' => $user->getDisplayName(),
                    'email' => $user->getEMailAddress()
                ]
            ], Http::STATUS_OK);

        } catch (\Exception $e) {
            $this->logger->error('Failed to get status: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);

            return new JSONResponse(
                ['error' => 'Failed to get status'],
                Http::STATUS_INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     * 
     * Verify authentication and return user info
     * 
     * @return JSONResponse
     */
    public function verifyAuth(): JSONResponse {
        try {
            $user = $this->userSession->getUser();
            if (!$user) {
                return new JSONResponse(
                    ['error' => 'User not authenticated'],
                    Http::STATUS_UNAUTHORIZED
                );
            }

            return new JSONResponse([
                'authenticated' => true,
                'user' => [
                    'uid' => $user->getUID(),
                    'displayName' => $user->getDisplayName(),
                    'email' => $user->getEMailAddress()
                ]
            ], Http::STATUS_OK);

        } catch (\Exception $e) {
            return new JSONResponse(
                ['error' => 'Authentication verification failed'],
                Http::STATUS_INTERNAL_SERVER_ERROR
            );
        }
    }
}

