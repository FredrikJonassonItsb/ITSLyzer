<?php
declare(strict_types=1);

namespace OCA\OutlookIntegrator\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

class Version1000Date20241027000000 extends SimpleMigrationStep {
    /**
     * @param IOutput $output
     * @param Closure $schemaClosure The `\Closure` returns a `ISchemaWrapper`
     * @param array $options
     * @return null|ISchemaWrapper
     */
    public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        // Create participant settings table
        if (!$schema->hasTable('outlook_participant_settings')) {
            $table = $schema->createTable('outlook_participant_settings');
            
            $table->addColumn('id', Types::BIGINT, [
                'autoincrement' => true,
                'notnull' => true,
                'unsigned' => true,
            ]);
            
            $table->addColumn('event_id', Types::STRING, [
                'notnull' => true,
                'length' => 255,
            ]);
            
            $table->addColumn('email', Types::STRING, [
                'notnull' => true,
                'length' => 255,
            ]);
            
            $table->addColumn('auth_level', Types::STRING, [
                'notnull' => true,
                'length' => 50,
                'default' => 'none',
            ]);
            
            $table->addColumn('personal_number', Types::TEXT, [
                'notnull' => false,
            ]);
            
            $table->addColumn('sms_number', Types::TEXT, [
                'notnull' => false,
            ]);
            
            $table->addColumn('secure_email', Types::BOOLEAN, [
                'notnull' => true,
                'default' => false,
            ]);
            
            $table->addColumn('notification', Types::STRING, [
                'notnull' => true,
                'length' => 50,
                'default' => 'email',
            ]);
            
            $table->addColumn('created_at', Types::BIGINT, [
                'notnull' => true,
                'default' => 0,
            ]);
            
            $table->setPrimaryKey(['id']);
            $table->addIndex(['event_id'], 'outlook_ps_event_id');
            $table->addIndex(['email'], 'outlook_ps_email');
        }

        // Create meeting metadata table
        if (!$schema->hasTable('outlook_meeting_metadata')) {
            $table = $schema->createTable('outlook_meeting_metadata');
            
            $table->addColumn('id', Types::BIGINT, [
                'autoincrement' => true,
                'notnull' => true,
                'unsigned' => true,
            ]);
            
            $table->addColumn('event_id', Types::STRING, [
                'notnull' => true,
                'length' => 255,
            ]);
            
            $table->addColumn('talk_token', Types::STRING, [
                'notnull' => true,
                'length' => 255,
            ]);
            
            $table->addColumn('talk_url', Types::TEXT, [
                'notnull' => true,
            ]);
            
            $table->addColumn('created_by', Types::STRING, [
                'notnull' => true,
                'length' => 64,
            ]);
            
            $table->addColumn('created_at', Types::BIGINT, [
                'notnull' => true,
                'default' => 0,
            ]);
            
            $table->setPrimaryKey(['id']);
            $table->addUniqueIndex(['event_id'], 'outlook_mm_event_id');
            $table->addIndex(['talk_token'], 'outlook_mm_talk_token');
        }

        return $schema;
    }
}

