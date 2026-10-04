import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, Matches, MaxLength } from 'class-validator';

//قوانین دقیق برای ثبت نام کاربران 


//نرمال سازی متن ورودی از کاربر (شمال فاصبه های اشتباهات متنی و غیره)
const normalize = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalize)
  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/, {
    message: 'username must be 3-30 characters: lowercase letters, digits or underscore',
  })
  username!: string;

  @Transform(normalize)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsByteLength(8, 72, { message: 'password must be between 8 and 72 bytes' })
  password!: string;
}