<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Service;

use OCA\OutlookIntegrator\Service\TalkService;
use OCA\OutlookIntegrator\Service\CalendarService;
use OCA\OutlookIntegrator\Service\ParticipantService;
use Psr\Log\LoggerInterface;

class MeetingService {
    private TalkService $talkService;
    private CalendarService $calendarService;
    private ParticipantService $participantService;
    private LoggerInterface $logger;

    public function __construct(
        TalkService $talkService,
        CalendarService $calendarService,
        ParticipantService $participantService,
        LoggerInterface $logger
    ) {
        $this->talkService = $talkService;
        $this->calendarService = $calendarService;
        $this->participantService = $participantService;
        $this->logger = $logger;
    }

    /**
     * Create a complete meeting with Talk room and calendar event
     * 
     * @param string $userId User ID
     * @param array $data Meeting data
     * @return array Meeting result
     */
    public function createMeeting(string $userId, array $data): array {
        try {
            $this->logger->info('Creating meeting for user: ' . $userId, [
                'app' => 'outlook_integrator'
            ]);

            // 1. Create Talk room
            $talkRoom = $this->talkService->createRoom(
                $userId,
                $data['title']
            );

            $this->logger->info('Talk room created: ' . $talkRoom['token'], [
                'app' => 'outlook_integrator'
            ]);

            // 2. Add participants to Talk room
            if (!empty($data['participants'])) {
                foreach ($data['participants'] as $participant) {
                    try {
                        $this->talkService->addParticipant(
                            $talkRoom['token'],
                            $participant['email']
                        );
                    } catch (\Exception $e) {
                        // Log but continue if adding participant fails
                        $this->logger->warning('Failed to add participant to Talk room: ' . $e->getMessage(), [
                            'email' => $participant['email'],
                            'app' => 'outlook_integrator'
                        ]);
                    }
                }
            }

            // 3. Create calendar event
            $calendarEvent = $this->calendarService->createEvent(
                $userId,
                [
                    'summary' => $data['title'],
                    'dtstart' => $data['start'],
                    'dtend' => $data['end'],
                    'description' => "Nextcloud Talk: " . $talkRoom['url'],
                    'location' => $talkRoom['url'],
                    'attendees' => array_map(
                        fn($p) => $p['email'],
                        $data['participants'] ?? []
                    )
                ]
            );

            $this->logger->info('Calendar event created: ' . $calendarEvent['id'], [
                'app' => 'outlook_integrator'
            ]);

            // 4. Save participant settings
            if (!empty($data['participants'])) {
                foreach ($data['participants'] as $participant) {
                    if (isset($participant['settings']) && !empty($participant['settings'])) {
                        try {
                            $this->participantService->saveSettings(
                                $calendarEvent['id'],
                                $participant['email'],
                                $participant['settings']
                            );
                        } catch (\Exception $e) {
                            $this->logger->warning('Failed to save participant settings: ' . $e->getMessage(), [
                                'email' => $participant['email'],
                                'app' => 'outlook_integrator'
                            ]);
                        }
                    }
                }
            }

            // 5. Return meeting information
            return [
                'id' => $calendarEvent['id'],
                'talkUrl' => $talkRoom['url'],
                'talkToken' => $talkRoom['token'],
                'talkPassword' => $talkRoom['password'] ?? null,
                'calendarEventId' => $calendarEvent['id'],
                'calendarUrl' => $this->calendarService->getCalendarUrl($userId),
                'created' => date('c')
            ];

        } catch (\Exception $e) {
            $this->logger->error('Failed to create meeting: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);
            throw $e;
        }
    }
}

