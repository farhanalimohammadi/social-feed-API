import { Expose, Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator';

export class CreateCommentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;

  // @Expose لازم است تا Transform حتی وقتی فقط parent_comment_id ارسال شده اجرا شود
  @Expose()
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
      value ?? obj.parent_comment_id,
  )
  @IsOptional()
  @IsUUID('4')
  parentCommentId?: string;

  // نام فیلد طبق صورت تسک؛ فقط alias ورودی است و سرویس همیشه parentCommentId را می‌خواند
  @IsOptional()
  @IsUUID('4')
  @ValidateBy({
    name: 'matchesParentCommentId',
    validator: {
      validate: (value: unknown, args: ValidationArguments) =>
        value === (args.object as CreateCommentDto).parentCommentId,
      defaultMessage: () => 'parent_comment_id and parentCommentId must not differ',
    },
  })
  parent_comment_id?: string;
}
