import { Organization } from '../../organizations/entities/organization.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';

@Entity('subscribers')
export class Subscriber {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255 })
    email: string;

    @ManyToOne(() => Organization, organization => organization.subscribers, { onDelete: 'CASCADE' })
    organization: Organization;

    @Column('jsonb', { nullable: true })
    customFields: object;

    @Column({ type: 'text', nullable: true })
    gpgPublicKey: string; // PGP/GPG public key for encrypted emails

    @Column({ default: false })
    encryptEmails: boolean; // Whether to encrypt emails for this subscriber

    @CreateDateColumn()
    createdAt: Date;
}