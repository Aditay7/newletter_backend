import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { List } from './entities/list.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Subscriber } from '../subscribers/entities/subscriber.entity';
import { User } from '../users/entities/user.entity';
import { InjectKnex } from 'nestjs-knex';
import * as fs from 'fs';
import * as csv from 'fast-csv';
import { Knex } from 'knex';

@Injectable()
export class ListService {
  constructor(
    @InjectRepository(List)
    private listRepository: Repository<List>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Subscriber)
    private subscriberRepository: Repository<Subscriber>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectKnex() private readonly knex: Knex,
  ) {}

  validateCustomFieldData(schema: Record<string, any>, data: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema) {
      return { valid: true, errors: [] };
    }

    // Check required fields
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      if (fieldSchema.required && (data[fieldName] === undefined || data[fieldName] === null)) {
        errors.push(`Required field '${fieldName}' is missing`);
        continue;
      }

      // Type validation
      if (data[fieldName] !== undefined && data[fieldName] !== null) {
        const value = data[fieldName];
        const expectedType = fieldSchema.type;

        switch (expectedType) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push(`Field '${fieldName}' must be a string`);
            }
            break;
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
              errors.push(`Field '${fieldName}' must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push(`Field '${fieldName}' must be a boolean`);
            }
            break;
          case 'date':
            if (isNaN(Date.parse(value))) {
              errors.push(`Field '${fieldName}' must be a valid date`);
            }
            break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async create(createListDto: CreateListDto, userId?: string) {
    const list = new List();
    list.name = createListDto.name;
    list.customFields = createListDto.customFields;

    if (createListDto.organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: createListDto.organizationId },
      });
      if (organization) {
        list.organization = organization;
      }
    }

    if (userId) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (user) {
        list.user = user;
      }
    }

    return this.listRepository.save(list);
  }

  findAll(userId?: string, organizationId?: string) {
    const where: any = {};
    if (userId) {
      where.user = { id: userId };
    }
    if (organizationId) {
      where.organization = { id: organizationId };
    }
    return this.listRepository.find({ 
      where,
      relations: ['organization', 'user'] 
    });
  }

  async update(id: string, updateListDto: UpdateListDto, userId?: string, organizationId?: string) {
    const where: any = { id };
    if (userId) {
      where.user = { id: userId };
    }
    if (organizationId) {
      where.organization = { id: organizationId };
    }
    
    const list = await this.listRepository.findOne({ where, relations: ['user', 'organization'] });
    if (!list) {
      throw new NotFoundException('List not found or you do not have permission to update it');
    }

    if (updateListDto.name) list.name = updateListDto.name;
    if (updateListDto.customFields)
      list.customFields = updateListDto.customFields;

    if (updateListDto.organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: updateListDto.organizationId },
      });
      if (organization) {
        list.organization = organization;
      }
    }
    return this.listRepository.save(list);
  }

  async importCsv(listId: string, filePath: string) {
    // Find list
    const list = await this.listRepository.findOne({
      where: { id: listId },
      relations: ['organization'],
    });
    if (!list) throw new NotFoundException('List not found');

    const org = list.organization;
    const tempData: Partial<Subscriber>[] = [];
    const seenEmails = new Set<string>();
    const validationErrors: string[] = [];
    const listCustomFieldSchema = list.customFields as Record<string, any> || {};

    // Simple regex for email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('error', reject)
        .on('data', (row) => {
          const email = row.email?.trim().toLowerCase();

          // Skip invalid or empty emails
          if (!email || !emailRegex.test(email)) return;

          // Skip duplicates inside the same CSV file
          if (seenEmails.has(email)) return;
          seenEmails.add(email);

          // Dynamically collect all custom fields (except 'email')
          const customFields: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            if (key.toLowerCase() !== 'email') {
              const value = row[key]?.trim();
              if (value) customFields[key] = value;
            }
          }

          // Validate custom fields against schema if defined
          if (Object.keys(listCustomFieldSchema).length > 0) {
            const validation = this.validateCustomFieldData(listCustomFieldSchema, customFields);
            if (!validation.valid) {
              validationErrors.push(`Row with email ${email}: ${validation.errors.join(', ')}`);
              return; // Skip this row
            }
          }

          // Collect valid subscriber data
          tempData.push({
            email,
            customFields,
            organization: org,
          });
        })
        .on('end', async () => {
          try {
            // Find existing emails from DB for this org
            const existing = await this.subscriberRepository
              .createQueryBuilder('subscriber')
              .select('subscriber.email')
              .where('subscriber.organizationId = :orgId', { orgId: org.id })
              .andWhere('subscriber.email IN (:...emails)', {
                emails: Array.from(seenEmails),
              })
              .getMany();

            const existingEmails = new Set(existing.map((s) => s.email.toLowerCase()));

            // Filter out emails already in DB
            const newSubscribers = tempData.filter(
              (s) => !existingEmails.has(s.email),
            );

            // also remove duplicates within same CSV again
            const seen = new Set();
            const finalSubscribers = newSubscribers.filter((s) => {
              if (seen.has(s.email)) return false;
              seen.add(s.email);
              return true;
            });

            // Bulk save only new ones
            if (finalSubscribers.length > 0) {
              const created = this.subscriberRepository.create(finalSubscribers);
              await this.subscriberRepository.save(created);
            }

            // Clean up uploaded file
            fs.unlinkSync(filePath);

            // Return summary
            resolve({
              totalCsvRows: seenEmails.size,
              alreadyExisted: existingEmails.size,
              newlyAdded: finalSubscribers.length,
              skipped: seenEmails.size - finalSubscribers.length,
              validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
              message: `✅ Imported ${finalSubscribers.length} new subscribers. Skipped ${existingEmails.size} duplicates.${validationErrors.length > 0 ? ` ${validationErrors.length} validation errors.` : ''}`,
            });
          } catch (err) {
            fs.unlinkSync(filePath);
            reject(new BadRequestException('Error processing CSV file.'));
          }
        });
    });
  }
  
  async segmentSubscribers(listId: string, filters: Record<string, any>) {
    // Find list + organization
    const list = await this.listRepository.findOne({
      where: { id: listId },
      relations: ['organization'],
    });

    if (!list) throw new NotFoundException('List not found');
    if (!list.organization) throw new BadRequestException('List not linked to organization');

    // Build query
    const query = this.subscriberRepository
      .createQueryBuilder('subscriber')
      .where('subscriber.organizationId = :orgId', { orgId: list.organization.id });

    // Apply advanced filters
    if (filters.customFields) {
      for (const [key, value] of Object.entries(filters.customFields)) {
        if (typeof value === 'object' && value !== null) {
          // Support operators like { $gt: 18 }, { $contains: "text" }
          if (value['$gt']) {
            query.andWhere(`CAST(subscriber.customFields ->> '${key}' AS INTEGER) > :${key}_gt`, {
              [`${key}_gt`]: value['$gt'],
            });
          } else if (value['$lt']) {
            query.andWhere(`CAST(subscriber.customFields ->> '${key}' AS INTEGER) < :${key}_lt`, {
              [`${key}_lt`]: value['$lt'],
            });
          } else if (value['$contains']) {
            query.andWhere(`subscriber.customFields ->> '${key}' ILIKE :${key}_contains`, {
              [`${key}_contains`]: `%${value['$contains']}%`,
            });
          } else if (value['$eq']) {
            query.andWhere(`subscriber.customFields ->> '${key}' = :${key}_eq`, {
              [`${key}_eq`]: value['$eq'],
            });
          }
        } else {
          // Simple equality
          query.andWhere(`subscriber.customFields ->> '${key}' = :${key}_value`, {
            [`${key}_value`]: String(value),
          });
        }
      }
    }

    // Filter by email domain
    if (filters.emailDomain) {
      query.andWhere('subscriber.email LIKE :domain', {
        domain: `%@${filters.emailDomain}`,
      });
    }

    // Filter by creation date range
    if (filters.createdAfter) {
      query.andWhere('subscriber.createdAt >= :createdAfter', {
        createdAfter: new Date(filters.createdAfter),
      });
    }

    if (filters.createdBefore) {
      query.andWhere('subscriber.createdAt <= :createdBefore', {
        createdBefore: new Date(filters.createdBefore),
      });
    }

    // Filter by active status
    if (filters.isActive !== undefined) {
      query.andWhere('subscriber.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    // Pagination support
    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    // Execute query
    const [results, total] = await query.getManyAndCount();

    // Return filtered data with metadata
    return {
      total,
      count: results.length,
      filters,
      data: results,
    };
  }

  async getByCidTx(tx: Knex.Transaction, listCid: string) {
    try {
      console.log(listCid);
      const list = await tx('lists').where({ id: listCid }).first();
      console.log('list', list);
      if (!list) {
        throw new Error(`List with CID ${listCid} not found`);
      }
      // await this.enforceEntityPermissionTx(tx, context, 'list', list.id, 'view');
      return list;
    } catch (error) {
      console.error('Error fetching list by CID:', error);
      throw error;
    }
  }
  // async enforceEntityPermissionTx(tx: any, context: any, entityTypeId: string, entityId: any, requiredOperations: string) {
  //   if (!entityId) {
  //     throw new HttpError('Attendee Type Not Found', {}, HttpStatus.NOT_FOUND);
  //   }
  //   const result = await this._checkPermissionTx(tx, context, entityTypeId, entityId, requiredOperations);
  //   if (!result) {
  //     log.apply(`Denying permission ${entityTypeId}.${entityId} ${requiredOperations}`);
  //     throw new HttpError('Attendee Type Not Found', {}, HttpStatus.NOT_FOUND);
  //   }
  // }

  // async _checkPermissionTx(tx: any, context: any, entityTypeId: any, entityId: any, requiredOperations: any) {
  //   if (!context.user) {
  //     return false;
  //   }

  //   const entityType = entitySettings.getEntityType(entityTypeId);

  //   if (typeof requiredOperations === 'string') {
  //     requiredOperations = [requiredOperations];
  //   }

  //   requiredOperations = this.filterPermissionsByRestrictedAccessHandler(context, entityTypeId, entityId, requiredOperations, 'checkPermissions');

  //   if (requiredOperations.length === 0) {
  //     return false;
  //   }

  //   if (context.user.admin) { // This handles the getAdminContext() case. In this case we don't check the permission, but just the existence.
  //     const existsQuery = tx(entityType.entitiesTable);

  //     if (entityId) {
  //       existsQuery.where('id', entityId);
  //     }

  //     const exists = await existsQuery.first();

  //     return !!exists;

  //   } else {
  //     const permsQuery = tx(entityType.permissionsTable)
  //       .where('user', context.user.id)
  //       .whereIn('operation', requiredOperations);

  //     if (entityId) {
  //       permsQuery.andWhere('entity', entityId);
  //     }

  //     const perms = await permsQuery.first();

  //     return !!perms;
  //   }
  // }

  // filterPermissionsByRestrictedAccessHandler(context: any, entityTypeId: any, entityId: any, permissions: any, operationMsg: any) {
  //   if (context.user.restrictedAccessHandler) {
  //     const originalOperations = permissions;
  //     if (context.user.restrictedAccessHandler.permissions) {
  //       const entityPerms = context.user.restrictedAccessHandler.permissions[entityTypeId];

  //       if (!entityPerms) {
  //         permissions = [];
  //       } else if (entityPerms === true) {
  //         // no change to operations
  //       } else if (entityPerms instanceof Set) {
  //         permissions = permissions.filter(perm => entityPerms.has(perm));
  //       } else {
  //         if (entityId) {
  //           const allowedPerms = entityPerms[entityId];
  //           if (allowedPerms) {
  //             permissions = permissions.filter(perm => allowedPerms.has(perm));
  //           } else {
  //             const allowedPerms = entityPerms['default'];
  //             if (allowedPerms) {
  //               permissions = permissions.filter(perm => allowedPerms.has(perm));
  //             } else {
  //               permissions = [];
  //             }
  //           }
  //         } else {
  //           const allowedPerms = entityPerms['default'];
  //           if (allowedPerms) {
  //             permissions = permissions.filter(perm => allowedPerms.has(perm));
  //           } else {
  //             permissions = [];
  //           }
  //         }
  //       }
  //     } else {
  //       permissions = [];
  //     }
  //     log.verbose(operationMsg + ' with restrictedAccessHandler --  entityTypeId: ' + entityTypeId + '  entityId: ' + entityId + '  operations: [' + originalOperations + '] -> [' + permissions + ']');
  //   }

  //   return permissions;
  // }
  // async listTx(tx: any, listId: any) {
  //   return await tx('custom_fields').where({ list: listId }).select(['id', 'name', 'type', 'help', 'key', 'column', 'settings', 'group', 'default_value', 'required', 'order_list', 'order_subscribe', 'order_manage']).orderBy(knex.raw('-order_list'), 'desc').orderBy('id', 'asc');
  // }
  // async listGroupedTx(tx: any, listId: any) {
  //   const flds = await this.listTx(tx, listId);

  //   const fldsById = {};
  //   for (const fld of flds) {
  //     fld.settings = JSON.parse(fld.settings);

  //     fldsById[fld.id] = fld;

  //     if (fieldTypes[fld.type].grouped) {
  //       fld.settings.options = [];
  //       fld.groupedOptions = {};
  //     }
  //   }

  //   for (const fld of flds) {
  //     if (fld.group) {
  //       const group = fldsById[fld.group];
  //       group.settings.options.push({ key: fld.column, label: fld.name });
  //       group.groupedOptions[fld.column] = fld;
  //     }
  //   }

  //   const groupedFlds = flds.filter(fld => !fld.group);

  //   for (const fld of flds) {
  //     delete fld.group;
  //   }

  //   return groupedFlds;
  // }
}
