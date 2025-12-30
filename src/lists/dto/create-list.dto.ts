import { IsNotEmpty, IsString, IsUUID, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomFieldSchema {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    required?: boolean;
    defaultValue?: any;
}

export class CreateListDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsUUID()
    organizationId?: string;

    @IsOptional()
    @IsObject()
    customFields?: Record<string, CustomFieldSchema>;
}