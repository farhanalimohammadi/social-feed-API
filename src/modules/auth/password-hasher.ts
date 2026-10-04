import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
//رمز نگاری پسور دریافتی از کاربران برای امینت بیشتر
const BCRYPT_COST = 10;

@Injectable()
export class PasswordHasher {
  //تولید یک رمز فیک و دروغین و نگهداریش در حافظه
  private readonly dummyHash: Promise<string> = bcrypt.hash('dummy-password-for-timing', BCRYPT_COST);


  //تبدیل به هش 
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  //مقایشه رمز در حین لاگین
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  //اینم همون رمز فیکه که برای گهراه سازی هکر ما انجامش میدیم 
  //در اصل این رمز فیک یه وقت تلف کن برای کاربره جلوتر کامنت گذاری هارو بخونین میفهمین
  getDummyHash(): Promise<string> {
    return this.dummyHash;
  }
}
