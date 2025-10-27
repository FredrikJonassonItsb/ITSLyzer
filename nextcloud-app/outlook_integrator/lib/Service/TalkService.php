<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Service;

use OCP\Http\Client\IClientService;
use OCP\IConfig;
use OCP\IUserManager;
use OCP\IURLGenerator;
use Psr\Log\LoggerInterface;

class TalkService {
    const ROOM_TYPE_PUBLIC = 3;
    const ROOM_TYPE_GROUP = 2;
    const ROOM_TYPE_ONE_TO_ONE = 1;

    private IClientService $clientService;
    private IConfig $config;
    private IUserManager $userManager;
    private IURLGenerator $urlGenerator;
    private LoggerInterface $logger;
    private string $baseUrl;

    public function __construct(
        IClientService $clientService,
        IConfig $config,
        IUserManager $userManager,
        IURLGenerator $urlGenerator,
        LoggerInterface $logger
    ) {
        $this->clientService = $clientService;
        $this->config = $config;
        $this->userManager = $userManager;
        $this->urlGenerator = $urlGenerator;
        $this->logger = $logger;
        $this->baseUrl = $this->urlGenerator->getAbsoluteURL('');
    }

    /**
     * Create a Talk room
     * 
     * @param string $userId User ID
     * @param string $name Room name
     * @param int $type Room type (default: public)
     * @return array Room data
     */
    public function createRoom(string $userId, string $name, int $type = self::ROOM_TYPE_PUBLIC): array {
        try {
            // Use OCS API to create room
            $response = $this->request(
                'POST',
                '/ocs/v2.php/apps/spreed/api/v4/room',
                [
                    'roomType' => $type,
                    'roomName' => $name
                ],
                $userId
            );

            if (!isset($response['ocs']['data'])) {
                throw new \Exception('Invalid response from Talk API');
            }

            $roomData = $response['ocs']['data'];

            return [
                'token' => $roomData['token'],
                'url' => $this->baseUrl . '/call/' . $roomData['token'],
                'name' => $roomData['displayName'],
                'password' => $roomData['hasPassword'] ? true : null
            ];

        } catch (\Exception $e) {
            $this->logger->error('Failed to create Talk room: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);
            throw $e;
        }
    }

    /**
     * Add participant to Talk room
     * 
     * @param string $token Room token
     * @param string $email Participant email
     * @return void
     */
    public function addParticipant(string $token, string $email): void {
        try {
            // Try to find user by email
            $user = $this->findUserByEmail($email);

            if ($user) {
                // Add registered user to room
                $this->request(
                    'POST',
                    "/ocs/v2.php/apps/spreed/api/v4/room/{$token}/participants",
                    [
                        'newParticipant' => $user->getUID(),
                        'source' => 'users'
                    ],
                    $user->getUID()
                );

                $this->logger->info('Added participant to Talk room', [
                    'token' => $token,
                    'user' => $user->getUID(),
                    'app' => 'outlook_integrator'
                ]);
            } else {
                // User not found, they can join as guest via link
                $this->logger->info('User not found, will join as guest', [
                    'email' => $email,
                    'app' => 'outlook_integrator'
                ]);
            }

        } catch (\Exception $e) {
            $this->logger->warning('Failed to add participant: ' . $e->getMessage(), [
                'token' => $token,
                'email' => $email,
                'app' => 'outlook_integrator'
            ]);
            // Don't throw, allow meeting creation to continue
        }
    }

    /**
     * Find user by email address
     * 
     * @param string $email Email address
     * @return \OCP\IUser|null User or null if not found
     */
    private function findUserByEmail(string $email): ?\OCP\IUser {
        $users = $this->userManager->getByEmail($email);
        return !empty($users) ? $users[0] : null;
    }

    /**
     * Make HTTP request to Talk API
     * 
     * @param string $method HTTP method
     * @param string $endpoint API endpoint
     * @param array $data Request data
     * @param string $userId User ID for authentication
     * @return array Response data
     */
    private function request(string $method, string $endpoint, array $data = [], string $userId = ''): array {
        try {
            $client = $this->clientService->newClient();
            $url = $this->baseUrl . $endpoint;

            $options = [
                'headers' => [
                    'OCS-APIRequest' => 'true',
                    'Accept' => 'application/json',
                    'Content-Type' => 'application/json'
                ],
                'json' => $data
            ];

            // Add authentication if user ID provided
            if ($userId) {
                $user = $this->userManager->get($userId);
                if ($user) {
                    // Use internal authentication
                    // In production, this would use proper authentication mechanism
                    $options['headers']['X-User'] = $userId;
                }
            }

            $response = $client->request($method, $url, $options);
            $body = $response->getBody();

            return json_decode($body, true);

        } catch (\Exception $e) {
            $this->logger->error('Talk API request failed: ' . $e->getMessage(), [
                'method' => $method,
                'endpoint' => $endpoint,
                'app' => 'outlook_integrator'
            ]);
            throw $e;
        }
    }
}

