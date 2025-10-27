<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Service;

use OCA\OutlookIntegrator\Db\ParticipantSettingMapper;
use OCA\OutlookIntegrator\Db\ParticipantSetting;
use OCP\Security\ICrypto;
use Psr\Log\LoggerInterface;

class ParticipantService {
    private ParticipantSettingMapper $mapper;
    private ICrypto $crypto;
    private LoggerInterface $logger;

    public function __construct(
        ParticipantSettingMapper $mapper,
        ICrypto $crypto,
        LoggerInterface $logger
    ) {
        $this->mapper = $mapper;
        $this->crypto = $crypto;
        $this->logger = $logger;
    }

    /**
     * Save participant settings
     * 
     * @param string $eventId Event ID
     * @param string $email Participant email
     * @param array $settings Settings data
     * @return void
     */
    public function saveSettings(string $eventId, string $email, array $settings): void {
        try {
            $entity = new ParticipantSetting();
            $entity->setEventId($eventId);
            $entity->setEmail($email);
            $entity->setAuthLevel($settings['authLevel'] ?? 'none');
            $entity->setSecureEmail($settings['secureEmail'] ?? false);
            $entity->setNotification($settings['notification'] ?? 'email');

            // Encrypt sensitive data
            if (isset($settings['personalNumber']) && !empty($settings['personalNumber'])) {
                $encrypted = $this->encrypt($settings['personalNumber']);
                $entity->setPersonalNumber($encrypted);
            }

            if (isset($settings['smsNumber']) && !empty($settings['smsNumber'])) {
                $encrypted = $this->encrypt($settings['smsNumber']);
                $entity->setSmsNumber($encrypted);
            }

            $this->mapper->insert($entity);

            $this->logger->info('Participant settings saved', [
                'eventId' => $eventId,
                'email' => $email,
                'app' => 'outlook_integrator'
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Failed to save participant settings: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);
            throw $e;
        }
    }

    /**
     * Get participant settings for an event
     * 
     * @param string $eventId Event ID
     * @return array Participant settings
     */
    public function getSettings(string $eventId): array {
        try {
            $entities = $this->mapper->findByEventId($eventId);
            
            $settings = [];
            foreach ($entities as $entity) {
                $settings[$entity->getEmail()] = [
                    'authLevel' => $entity->getAuthLevel(),
                    'secureEmail' => $entity->getSecureEmail(),
                    'notification' => $entity->getNotification(),
                    'personalNumber' => $entity->getPersonalNumber() ? 
                        $this->decrypt($entity->getPersonalNumber()) : null,
                    'smsNumber' => $entity->getSmsNumber() ? 
                        $this->decrypt($entity->getSmsNumber()) : null
                ];
            }

            return $settings;

        } catch (\Exception $e) {
            $this->logger->error('Failed to get participant settings: ' . $e->getMessage(), [
                'exception' => $e,
                'app' => 'outlook_integrator'
            ]);
            return [];
        }
    }

    /**
     * Encrypt sensitive data
     * 
     * @param string $data Data to encrypt
     * @return string Encrypted data
     */
    private function encrypt(string $data): string {
        return $this->crypto->encrypt($data);
    }

    /**
     * Decrypt sensitive data
     * 
     * @param string $data Encrypted data
     * @return string Decrypted data
     */
    private function decrypt(string $data): string {
        try {
            return $this->crypto->decrypt($data);
        } catch (\Exception $e) {
            $this->logger->error('Failed to decrypt data: ' . $e->getMessage(), [
                'app' => 'outlook_integrator'
            ]);
            return '';
        }
    }
}

