import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString } from 'class-validator';
//بررسی ایمیل و نام کاربری در حین لاگین 
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @IsByteLength(1, 72)
  password!: string;
}