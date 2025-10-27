<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Db;

use OCP\AppFramework\Db\Entity;

/**
 * @method string getEventId()
 * @method void setEventId(string $eventId)
 * @method string getEmail()
 * @method void setEmail(string $email)
 * @method string getAuthLevel()
 * @method void setAuthLevel(string $authLevel)
 * @method string|null getPersonalNumber()
 * @method void setPersonalNumber(?string $personalNumber)
 * @method string|null getSmsNumber()
 * @method void setSmsNumber(?string $smsNumber)
 * @method bool getSecureEmail()
 * @method void setSecureEmail(bool $secureEmail)
 * @method string getNotification()
 * @method void setNotification(string $notification)
 * @method int getCreatedAt()
 * @method void setCreatedAt(int $createdAt)
 */
class ParticipantSetting extends Entity {
    protected $eventId;
    protected $email;
    protected $authLevel;
    protected $personalNumber;
    protected $smsNumber;
    protected $secureEmail;
    protected $notification;
    protected $createdAt;

    public function __construct() {
        $this->addType('eventId', 'string');
        $this->addType('email', 'string');
        $this->addType('authLevel', 'string');
        $this->addType('personalNumber', 'string');
        $this->addType('smsNumber', 'string');
        $this->addType('secureEmail', 'boolean');
        $this->addType('notification', 'string');
        $this->addType('createdAt', 'integer');
    }
}

