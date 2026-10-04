import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContentType } from '../../../generated/prisma/client.js';
//اعبار سنجی درخواستهای ساخت پست جدید بر اساس قالب های تعریف شده

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePostDto {
  @IsOptional()
  @IsEnum(ContentType)
  contentType: ContentType = ContentType.text;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  caption?: string;
}