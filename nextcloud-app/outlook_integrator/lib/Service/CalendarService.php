<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Service;

use OCP\IURLGenerator;
use OCP\IUserManager;
use Psr\Log\LoggerInterface;
use Sabre\VObject\Component\VCalendar;

class CalendarService {
    private IUserManager $userManager;
    private IURLGenerator $urlGenerator;
    private LoggerInterface $logger;

    public function __construct(
        IUserManager $userManager,
        IURLGenerator $urlGenerator,
        LoggerInterface $logger
    ) {
        $this->userManager = $userManager;
        $this->urlGenerator = $urlGenerator;
        $this->logger = $logger;
    }

    /**
     * Create a calendar event
     * 
     * @param string $userId User ID
     * @param array $eventData Event data
     * @return array Event information
     */
    public function createEvent(string $userId, array $eventData): array {
        try {
            // Create iCalendar object
            $vcalendar = new VCalendar();
            
            $uid = $this->generateUID();
            
            $vevent = $vcalendar->add('VEVENT', [
                'SUMMARY' => $eventData['summary'],
                'DTSTART' => $eventData['dtstart'],
                'DTEND' => $eventData['dtend'],
                'DESCRIPTION' => $eventData['description'] ?? '',
                'LOCATION' => $eventData['location'] ?? '',
                'UID' => $uid,
                'DTSTAMP' => new \DateTime(),
                'CREATED' => new \DateTime(),
                'LAST-MODIFIED' => new \DateTime(),
                'SEQUENCE' => 0,
                'STATUS' => 'CONFIRMED'
            ]);

            // Add organizer
            $user = $this->userManager->get($userId);
            if ($user && $user->getEMailAddress()) {
                $vevent->add('ORGANIZER', 'mailto:' . $user->getEMailAddress(), [
                    'CN' => $user->getDisplayName()
                ]);
            }

            // Add attendees
            if (!empty($eventData['attendees'])) {
                foreach ($eventData['attendees'] as $attendee) {
                    $vevent->add('ATTENDEE', 'mailto:' . $attendee, [
                        'ROLE' => 'REQ-PARTICIPANT',
                        'PARTSTAT' => 'NEEDS-ACTION',
                        'RSVP' => 'TRUE'
                    ]);
                }
            }

            // Save to calendar using CalDAV
            $calendarId = $this->getDefaultCalendar($userId);
            $eventId = $this->saveToCalendar($userId, $calendarId, $uid, $vcalendar->serialize());

            $this->logger->info('Calendar event created', [
                'userId' => $userId,
                'eventId' => $eventId,
                'app' => 'outlook_integrator'
            ]);

            return [
                'id' => $eventId,
                'uid' => $uid,
                'calendarId' => $calendarId
            ];

        } catch (\Exception $e) {
            $this->logger->error('Failed to create calendar event: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);
            throw $e;
        }
    }

    /**
     * Get default calendar for user
     * 
     * @param string $userId User ID
     * @return string Calendar ID
     */
    private function getDefaultCalendar(string $userId): string {
        // In a real implementation, this would query the calendar app
        // For now, return a default calendar name
        return 'personal';
    }

    /**
     * Save event to calendar via CalDAV
     * 
     * @param string $userId User ID
     * @param string $calendarId Calendar ID
     * @param string $uid Event UID
     * @param string $icalData iCalendar data
     * @return string Event ID
     */
    private function saveToCalendar(string $userId, string $calendarId, string $uid, string $icalData): string {
        try {
            // In a real implementation, this would use Nextcloud's CalDAV backend
            // For now, we'll use a simplified approach
            
            // Get calendar manager
            $calendarManager = \OC::$server->get(\OCP\Calendar\IManager::class);
            
            // Search for calendars
            $calendars = $calendarManager->getCalendarsForPrincipal('principals/users/' . $userId);
            
            if (empty($calendars)) {
                throw new \Exception('No calendar found for user');
            }
            
            // Use first writable calendar
            $calendar = null;
            foreach ($calendars as $cal) {
                if ($cal->getPermissions() & \OCP\Constants::PERMISSION_CREATE) {
                    $calendar = $cal;
                    break;
                }
            }
            
            if (!$calendar) {
                throw new \Exception('No writable calendar found');
            }
            
            // Create event
            $calendar->createFromString($icalData);
            
            return $uid;

        } catch (\Exception $e) {
            $this->logger->error('Failed to save to calendar: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);
            
            // Fallback: return UID as event ID
            return $uid;
        }
    }

    /**
     * Generate unique event UID
     * 
     * @return string UID
     */
    private function generateUID(): string {
        return uniqid('outlook-integrator-', true) . '@' . $this->getHostname();
    }

    /**
     * Get hostname for UID generation
     * 
     * @return string Hostname
     */
    private function getHostname(): string {
        $url = $this->urlGenerator->getAbsoluteURL('');
        $parsed = parse_url($url);
        return $parsed['host'] ?? 'localhost';
    }

    /**
     * Get calendar URL for user
     * 
     * @param string $userId User ID
     * @return string Calendar URL
     */
    public function getCalendarUrl(string $userId): string {
        return $this->urlGenerator->linkToRouteAbsolute('calendar.view.index');
    }
}

