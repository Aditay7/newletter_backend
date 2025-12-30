import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { List } from '../../lists/entities/list.entity';

@Entity('rss_feeds')
export class RssFeed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  feedUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 24 })
  checkIntervalHours: number; // How often to check for new items

  @Column({ type: 'timestamp', nullable: true })
  lastChecked: Date;

  @Column({ type: 'jsonb', default: {} })
  processedItems: Record<string, boolean>; // Track which items have been sent

  @Column({ type: 'text', nullable: true })
  campaignTemplate: string; // Template for auto-generated campaigns

  @Column({ nullable: true })
  campaignSubject: string; // Subject line template with {title} etc

  @ManyToOne(() => List, { eager: true })
  @JoinColumn({ name: 'listId' })
  list: List;

  @Column()
  listId: string;

  @ManyToOne(() => Organization, { eager: false })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  organizationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
