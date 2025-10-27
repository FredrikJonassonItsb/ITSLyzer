<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Db;

use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

class ParticipantSettingMapper extends QBMapper {
    public function __construct(IDBConnection $db) {
        parent::__construct($db, 'outlook_participant_settings', ParticipantSetting::class);
    }

    /**
     * Find all participant settings for an event
     * 
     * @param string $eventId Event ID
     * @return ParticipantSetting[]
     */
    public function findByEventId(string $eventId): array {
        $qb = $this->db->getQueryBuilder();

        $qb->select('*')
           ->from($this->getTableName())
           ->where($qb->expr()->eq('event_id', $qb->createNamedParameter($eventId, IQueryBuilder::PARAM_STR)));

        return $this->findEntities($qb);
    }

    /**
     * Find participant setting by event ID and email
     * 
     * @param string $eventId Event ID
     * @param string $email Participant email
     * @return ParticipantSetting
     * @throws \OCP\AppFramework\Db\DoesNotExistException
     * @throws \OCP\AppFramework\Db\MultipleObjectsReturnedException
     */
    public function findByEventIdAndEmail(string $eventId, string $email): ParticipantSetting {
        $qb = $this->db->getQueryBuilder();

        $qb->select('*')
           ->from($this->getTableName())
           ->where($qb->expr()->eq('event_id', $qb->createNamedParameter($eventId, IQueryBuilder::PARAM_STR)))
           ->andWhere($qb->expr()->eq('email', $qb->createNamedParameter($email, IQueryBuilder::PARAM_STR)));

        return $this->findEntity($qb);
    }

    /**
     * Delete all participant settings for an event
     * 
     * @param string $eventId Event ID
     * @return void
     */
    public function deleteByEventId(string $eventId): void {
        $qb = $this->db->getQueryBuilder();

        $qb->delete($this->getTableName())
           ->where($qb->expr()->eq('event_id', $qb->createNamedParameter($eventId, IQueryBuilder::PARAM_STR)));

        $qb->execute();
    }
}

